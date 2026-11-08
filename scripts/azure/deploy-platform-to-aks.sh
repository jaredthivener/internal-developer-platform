#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
# shellcheck source=scripts/azure/common.sh
source "$SCRIPT_DIR/common.sh"

RESOURCE_GROUP="${RESOURCE_GROUP:-idp-azure-rg}"
LOCATION="${LOCATION:-westus3}"
AKS_CLUSTER_NAME="${AKS_CLUSTER_NAME:-idp-aks-auto}"
ACR_NAME="${ACR_NAME:-}"
ACR_SKU="${ACR_SKU:-Basic}"
IDP_WEB_IDENTITY_NAME="${IDP_WEB_IDENTITY_NAME:-${AKS_CLUSTER_NAME}-idp-web}"
CROSSPLANE_IDENTITY_NAME="${CROSSPLANE_IDENTITY_NAME:-${AKS_CLUSTER_NAME}-crossplane}"
DESIRED_STATE_CONTAINER="${DESIRED_STATE_CONTAINER:-desired-state}"
PORTAL_APP_NAME="${PORTAL_APP_NAME:-${AKS_CLUSTER_NAME}-portal}"
PLATFORM_KEYVAULT_NAME="${PLATFORM_KEYVAULT_NAME:-}"
IMAGE_PLATFORM="${IMAGE_PLATFORM:-}"
IMAGE_NAME="${IMAGE_NAME:-idp-web}"
IMAGE_TAG="${IMAGE_TAG:-$(date +%Y%m%d%H%M%S)}"
SKIP_IMAGE_BUILD="${SKIP_IMAGE_BUILD:-false}"
IMAGE_REF="${IMAGE_REF:-}"
WORKLOAD_ARCH="${WORKLOAD_ARCH:-}"
# Flux (microsoft.flux extension) deploys everything in-cluster from this Git
# repository and branch. Defaults: the origin remote and the checked-out branch.
GITOPS_REPO_URL="${GITOPS_REPO_URL:-}"
GITOPS_BRANCH="${GITOPS_BRANCH:-}"
FLUX_CONFIG_NAME="${FLUX_CONFIG_NAME:-idp-platform}"
# Must match the namespace of the Flux objects in platform/gitops.
FLUX_NAMESPACE=cluster-config
FLUX_TIMEOUT="${FLUX_TIMEOUT:-20m}"
# The portal is served on idp.<id>.<region>.aksapp.io, a host under the
# cluster's app routing default domain: AKS owns that domain, its wildcard
# certificate and its DNS records.
INGRESS_HOST=""
NEXTAUTH_EXTERNAL_URL="${NEXTAUTH_EXTERNAL_URL:-}"

log() {
  printf '\n[%s] %s\n' "$(date '+%H:%M:%S')" "$*"
}

fail() {
  printf '\nERROR: %s\n' "$*" >&2
  exit 1
}

require_tool() {
  command -v "$1" >/dev/null 2>&1 || fail "$1 is required. Install it before running this script."
}

generate_acr_name() {
  local sanitized random_suffix

  sanitized="$(printf '%s' "$AKS_CLUSTER_NAME" | tr '[:upper:]' '[:lower:]' | tr -cd '[:alnum:]')"
  sanitized="${sanitized:0:30}"
  random_suffix="$(openssl rand -hex 3)"
  printf '%s' "${sanitized}${random_suffix}"
}

resolve_acr_name() {
  if [[ -n "$ACR_NAME" ]]; then
    log "Using explicit ACR name $ACR_NAME"
    return
  fi

  local existing_acrs existing_count
  existing_acrs="$(az acr list --resource-group "$RESOURCE_GROUP" --query '[].name' -o tsv)"
  existing_count="$(printf '%s\n' "$existing_acrs" | awk 'NF { count++ } END { print count + 0 }')"

  if [[ "$existing_count" -eq 1 ]]; then
    ACR_NAME="$(printf '%s\n' "$existing_acrs" | awk 'NF { print; exit }')"
    log "Reusing existing ACR $ACR_NAME from resource group $RESOURCE_GROUP"
    return
  fi

  if [[ "$existing_count" -gt 1 ]]; then
    fail "Multiple ACR instances exist in resource group $RESOURCE_GROUP. Set ACR_NAME explicitly to choose one."
  fi

  ACR_NAME="$(generate_acr_name)"
  log "No existing ACR found in resource group $RESOURCE_GROUP. Generated new ACR name $ACR_NAME"
}

ensure_cluster_context() {
  log "Fetching kubeconfig for $AKS_CLUSTER_NAME"
  az aks get-credentials \
    --resource-group "$RESOURCE_GROUP" \
    --name "$AKS_CLUSTER_NAME" \
    --overwrite-existing >/dev/null
  wait_for_cluster_authorization
}

# The managed Gateway API CRDs, the application routing Gateway API
# implementation (GatewayClass approuting-istio), and the app routing add-on
# with its default domain (a *.aksapp.io domain, managed wildcard certificate
# and managed external-dns). New AKS Automatic clusters on 1.37 ship without
# them; the default domain is a preview feature (DefaultDomainPreview).
ensure_gateway_addons() {
  local state gateway_api istio app_routing default_domain
  state="$(az aks show --resource-group "$RESOURCE_GROUP" --name "$AKS_CLUSTER_NAME" \
    --query "join(' ', [to_string(ingressProfile.gatewayApi.installation), to_string(ingressProfile.webAppRouting.gatewayApiImplementations.appRoutingIstio.mode), to_string(ingressProfile.webAppRouting.enabled), to_string(ingressProfile.webAppRouting.defaultDomain.enabled)])" -o tsv)"
  log "Gateway add-on state (gatewayApi appRoutingIstio appRouting defaultDomain): $state"
  read -r gateway_api istio app_routing default_domain <<<"$state"

  if [[ "$gateway_api" != Standard || "$istio" != Enabled ]]; then
    log "Enabling managed Gateway API and the application routing Gateway implementation"
    az aks update --resource-group "$RESOURCE_GROUP" --name "$AKS_CLUSTER_NAME" \
      --enable-gateway-api --enable-app-routing-istio --output none
  fi

  if [[ "$default_domain" != true ]]; then
    log "Enabling the app routing default domain"
    if [[ "$app_routing" == true ]]; then
      az aks approuting update --resource-group "$RESOURCE_GROUP" --name "$AKS_CLUSTER_NAME" \
        --enable-default-domain --output none
    else
      # --nginx None: the portal uses the Gateway API, not an NGINX ingress.
      az aks approuting enable --resource-group "$RESOURCE_GROUP" --name "$AKS_CLUSTER_NAME" \
        --enable-default-domain --nginx None --output none
    fi
  fi
}

detect_workload_arch() {
  if [[ -n "$WORKLOAD_ARCH" ]]; then
    log "Using explicit workload architecture $WORKLOAD_ARCH"
    return
  fi

  local detected_arch
  detected_arch="$(kubectl get nodes -l kubernetes.azure.com/mode=user -o jsonpath='{.items[0].metadata.labels.kubernetes\.io/arch}' 2>/dev/null || true)"

  if [[ -z "$detected_arch" ]]; then
    detected_arch="$(kubectl get nodes -o jsonpath='{.items[0].metadata.labels.kubernetes\.io/arch}' 2>/dev/null || true)"
  fi

  [[ -n "$detected_arch" ]] || fail "Unable to detect a Kubernetes node architecture from the current cluster. Set WORKLOAD_ARCH explicitly and rerun."

  WORKLOAD_ARCH="$detected_arch"
  log "Detected workload architecture $WORKLOAD_ARCH"
}

# Checks explicit inputs before anything touches Azure or the cluster.
validate_inputs() {
  if [[ -n "$NEXTAUTH_EXTERNAL_URL" && "$NEXTAUTH_EXTERNAL_URL" != https://* ]]; then
    fail "NEXTAUTH_EXTERNAL_URL must use https (got $NEXTAUTH_EXTERNAL_URL). Entra ID only accepts https redirect URIs outside localhost."
  fi
}

# Flux deploys the branch as it is on the remote, not this checkout. When the
# tracked branch is the checked-out one, refuse to continue if they differ, so
# a deploy never silently ships something other than what is in front of you.
resolve_gitops_source() {
  local current_branch remote_sha
  current_branch="$(git -C "$ROOT_DIR" rev-parse --abbrev-ref HEAD)"
  GITOPS_REPO_URL="${GITOPS_REPO_URL:-$(git -C "$ROOT_DIR" remote get-url origin)}"
  GITOPS_BRANCH="${GITOPS_BRANCH:-$current_branch}"

  [[ "$GITOPS_REPO_URL" == https://* ]] \
    || fail "GITOPS_REPO_URL must be an https URL of a public Git repository (got $GITOPS_REPO_URL)."

  remote_sha="$(git -C "$ROOT_DIR" ls-remote "$GITOPS_REPO_URL" "refs/heads/$GITOPS_BRANCH" | cut -f1)"
  [[ -n "$remote_sha" ]] \
    || fail "Branch $GITOPS_BRANCH is not on $GITOPS_REPO_URL. Push it first: Flux deploys from the remote."

  if [[ "$GITOPS_BRANCH" == "$current_branch" ]]; then
    [[ "$remote_sha" == "$(git -C "$ROOT_DIR" rev-parse HEAD)" && -z "$(git -C "$ROOT_DIR" status --porcelain -- platform)" ]] \
      || fail "Flux deploys $GITOPS_BRANCH as pushed to $GITOPS_REPO_URL, but this checkout differs (unpushed commits or uncommitted platform/ changes). Commit and push first."
  fi
  log "Flux will deploy $GITOPS_REPO_URL branch $GITOPS_BRANCH at $remote_sha"
}

# Entra ID only accepts https redirect URIs outside localhost, so the portal is
# always published on https://INGRESS_HOST. The default domain is assigned
# once per cluster and kept across disable/enable, so reruns keep the host.
resolve_public_endpoint() {
  local domain="" attempt
  for attempt in $(seq 1 30); do
    domain="$(az aks approuting defaultdomain show --resource-group "$RESOURCE_GROUP" --name "$AKS_CLUSTER_NAME" \
      --query domainName -o tsv 2>/dev/null || true)"
    [[ -n "$domain" ]] && break
    log "Waiting for AKS to assign the default domain (attempt $attempt/30)"
    sleep 10
  done
  [[ -n "$domain" ]] \
    || fail "AKS assigned no default domain. Check: az aks approuting defaultdomain show --resource-group $RESOURCE_GROUP --name $AKS_CLUSTER_NAME"

  # The managed certificate is a wildcard, so the host is exactly one label
  # below the domain.
  INGRESS_HOST="idp.$domain"
  NEXTAUTH_EXTERNAL_URL="${NEXTAUTH_EXTERNAL_URL:-https://$INGRESS_HOST}"
  log "Public URL: $NEXTAUTH_EXTERNAL_URL"
}

# Registers the NextAuth callback on the portal app registration, keeping any
# redirect URIs that are already there.
ensure_redirect_uri() {
  local callback="${NEXTAUTH_EXTERNAL_URL%/}/api/auth/callback/azure-ad"
  local existing=() uri=""
  while IFS= read -r uri || [[ -n "$uri" ]]; do
    [[ -n "$uri" ]] && existing+=("$uri")
  done < <(az ad app show --id "$PORTAL_APP_ID" --query 'web.redirectUris[]' -o tsv)

  for uri in "${existing[@]+"${existing[@]}"}"; do
    [[ "$uri" == "$callback" ]] && return
  done

  log "Registering redirect URI $callback on $PORTAL_APP_NAME"
  az ad app update --id "$PORTAL_APP_ID" --web-redirect-uris "${existing[@]+"${existing[@]}"}" "$callback" --output none
}

resolve_azure_identities() {
  AZURE_TENANT_ID="$(az account show --query tenantId -o tsv)"
  AZURE_SUBSCRIPTION_ID="$(az account show --query id -o tsv)"
  CROSSPLANE_CLIENT_ID="$(az identity show --resource-group "$RESOURCE_GROUP" --name "$CROSSPLANE_IDENTITY_NAME" --query clientId -o tsv 2>/dev/null || true)"
  IDP_WEB_CLIENT_ID="$(az identity show --resource-group "$RESOURCE_GROUP" --name "$IDP_WEB_IDENTITY_NAME" --query clientId -o tsv 2>/dev/null || true)"
  DESIRED_STATE_STORAGE_ACCOUNT="$(az storage account list --resource-group "$RESOURCE_GROUP" --query "[?tags.\"idp-role\"=='desired-state'].name | [0]" -o tsv)"

  [[ -n "$CROSSPLANE_CLIENT_ID" && -n "$IDP_WEB_CLIENT_ID" && -n "$DESIRED_STATE_STORAGE_ACCOUNT" ]] \
    || fail "Managed identities or desired-state storage not found in $RESOURCE_GROUP. Run scripts/azure/bootstrap-aks-control-plane.sh first."

  DESIRED_STATE_BLOB_URL="$(az storage account show --resource-group "$RESOURCE_GROUP" --name "$DESIRED_STATE_STORAGE_ACCOUNT" --query primaryEndpoints.blob -o tsv)"

  PLATFORM_KEYVAULT_NAME="$(find_platform_keyvault)"
  PORTAL_APP_ID="$(find_portal_app_id)"
  [[ -n "$PLATFORM_KEYVAULT_NAME" && -n "$PORTAL_APP_ID" ]] \
    || fail "Platform Key Vault or Entra app $PORTAL_APP_NAME not found. Run scripts/azure/bootstrap-aks-control-plane.sh first."
}

# idp-system holds the app secret, which must exist before Flux starts the app;
# the Flux configuration namespace holds the settings Flux substitutes.
ensure_namespaces() {
  kubectl create namespace idp-system --dry-run=client -o yaml | kubectl_apply >/dev/null
  kubectl create namespace "$FLUX_NAMESPACE" --dry-run=client -o yaml | kubectl_apply >/dev/null
}

ensure_acr() {
  resolve_acr_name

  if az acr show --resource-group "$RESOURCE_GROUP" --name "$ACR_NAME" >/dev/null 2>&1; then
    log "Using existing ACR $ACR_NAME"
  else
    log "Creating ACR $ACR_NAME"
    az acr create \
      --resource-group "$RESOURCE_GROUP" \
      --name "$ACR_NAME" \
      --sku "$ACR_SKU" \
      --location "$LOCATION" \
      --admin-enabled false \
      --output none
  fi

  ACR_LOGIN_SERVER="$(az acr show --name "$ACR_NAME" --query loginServer -o tsv)"

  log "Attaching ACR $ACR_NAME to AKS $AKS_CLUSTER_NAME"
  az aks update \
    --resource-group "$RESOURCE_GROUP" \
    --name "$AKS_CLUSTER_NAME" \
    --attach-acr "$ACR_NAME" \
    --output none >/dev/null 2>&1 || true
}

build_and_push_image() {
  if [[ -n "$IMAGE_REF" && "$SKIP_IMAGE_BUILD" == "true" ]]; then
    log "Skipping image build and using explicit image reference $IMAGE_REF"
    return
  fi

  if [[ -z "$IMAGE_PLATFORM" ]]; then
    IMAGE_PLATFORM="linux/$WORKLOAD_ARCH"
  fi

  IMAGE_REF="$ACR_LOGIN_SERVER/$IMAGE_NAME:$IMAGE_TAG"

  log "Building and pushing $IMAGE_REF"
  local cmd=(
    az acr build
    --registry "$ACR_NAME"
    --image "$IMAGE_NAME:$IMAGE_TAG"
    --file "$ROOT_DIR/Dockerfile"
  )

  if [[ -n "$IMAGE_PLATFORM" ]]; then
    cmd+=(--platform "$IMAGE_PLATFORM")
  fi

  cmd+=("$ROOT_DIR")
  "${cmd[@]}"
}

# Builds the app's Kubernetes secret from Key Vault and computed values only,
# so no local env file (and no offline-mode flag) can leak into a cluster.
create_app_env_secret() {
  # Global, not local: the EXIT trap must still see it if a later step fails.
  temp_env_file="$(umask 077 && mktemp)"
  trap 'rm -f "${temp_env_file:-}"' EXIT

  local nextauth_secret client_secret
  nextauth_secret="$(az keyvault secret show --vault-name "$PLATFORM_KEYVAULT_NAME" --name nextauth-secret --query value -o tsv)"
  client_secret="$(az keyvault secret show --vault-name "$PLATFORM_KEYVAULT_NAME" --name portal-client-secret --query value -o tsv)"
  [[ -n "$nextauth_secret" && -n "$client_secret" ]] \
    || fail "Key Vault $PLATFORM_KEYVAULT_NAME is missing nextauth-secret or portal-client-secret. Rerun the bootstrap script."

  {
    printf 'NEXTAUTH_URL=%s\n' "$NEXTAUTH_EXTERNAL_URL"
    printf 'NEXTAUTH_SECRET=%s\n' "$nextauth_secret"
    printf 'AZURE_AD_CLIENT_ID=%s\n' "$PORTAL_APP_ID"
    printf 'AZURE_AD_CLIENT_SECRET=%s\n' "$client_secret"
    printf 'AZURE_AD_TENANT_ID=%s\n' "$AZURE_TENANT_ID"
    printf 'AZURE_SUBSCRIPTION_ID=%s\n' "$AZURE_SUBSCRIPTION_ID"
    printf 'IDP_DESIRED_STATE_AZURE_BLOB_ACCOUNT_URL=%s\n' "$DESIRED_STATE_BLOB_URL"
    printf 'IDP_DESIRED_STATE_AZURE_BLOB_CONTAINER=%s\n' "$DESIRED_STATE_CONTAINER"
  } > "$temp_env_file"
  unset nextauth_secret client_secret

  log "Creating application env secret with NEXTAUTH_URL=$NEXTAUTH_EXTERNAL_URL"
  kubectl -n idp-system create secret generic idp-app-env \
    --from-env-file="$temp_env_file" \
    --dry-run=client -o yaml | kubectl_apply

  rm -f "$temp_env_file"
}

# Values Flux substitutes for ${...} in platform/ (see platform/gitops). The
# watch label makes Flux re-apply as soon as they change, e.g. a new image.
write_platform_settings() {
  log "Writing Flux settings (image $IMAGE_REF, host $INGRESS_HOST)"
  kubectl -n "$FLUX_NAMESPACE" create configmap idp-platform-settings \
    --from-literal=AZURE_TENANT_ID="$AZURE_TENANT_ID" \
    --from-literal=AZURE_SUBSCRIPTION_ID="$AZURE_SUBSCRIPTION_ID" \
    --from-literal=LOCATION="$LOCATION" \
    --from-literal=CROSSPLANE_CLIENT_ID="$CROSSPLANE_CLIENT_ID" \
    --from-literal=IDP_WEB_CLIENT_ID="$IDP_WEB_CLIENT_ID" \
    --from-literal=IMAGE_REF="$IMAGE_REF" \
    --from-literal=WORKLOAD_ARCH="$WORKLOAD_ARCH" \
    --from-literal=INGRESS_HOST="$INGRESS_HOST" \
    --dry-run=client -o yaml \
    | kubectl label --local -f - reconcile.fluxcd.io/watch=Enabled -o yaml \
    | kubectl_apply
}

# The Flux configuration installs the microsoft.flux extension on first use and
# points one root Kustomization at platform/gitops/clusters/idp-aks-auto.
ensure_flux_configuration() {
  local common=(--resource-group "$RESOURCE_GROUP" --cluster-name "$AKS_CLUSTER_NAME" --cluster-type managedClusters --name "$FLUX_CONFIG_NAME")
  if az k8s-configuration flux show "${common[@]}" --output none 2>/dev/null; then
    log "Updating Flux configuration $FLUX_CONFIG_NAME to $GITOPS_REPO_URL branch $GITOPS_BRANCH"
    az k8s-configuration flux update "${common[@]}" --url "$GITOPS_REPO_URL" --branch "$GITOPS_BRANCH" --output none
  else
    log "Creating Flux configuration $FLUX_CONFIG_NAME (installs the Flux extension on first use)"
    az k8s-configuration flux create "${common[@]}" \
      --namespace "$FLUX_NAMESPACE" --scope cluster \
      --url "$GITOPS_REPO_URL" --branch "$GITOPS_BRANCH" \
      --kustomization name=platform path=./platform/gitops/clusters/idp-aks-auto prune=true \
      --output none
  fi
}

wait_for_platform() {
  local ks attempt deployed=""
  for ks in crossplane crossplane-providers crossplane-configs idp; do
    for attempt in $(seq 1 30); do
      kubectl -n "$FLUX_NAMESPACE" get kustomization "$ks" >/dev/null 2>&1 && break
      log "Waiting for Flux to create Kustomization $ks (attempt $attempt/30)"
      sleep 10
    done
    log "Waiting for Flux Kustomization $ks to become Ready"
    kubectl -n "$FLUX_NAMESPACE" wait --for=condition=Ready "kustomization/$ks" --timeout="$FLUX_TIMEOUT" \
      || fail "Flux Kustomization $ks is not Ready. Check: kubectl -n $FLUX_NAMESPACE get kustomizations,helmreleases; kubectl -n $FLUX_NAMESPACE describe kustomization $ks"
  done

  # On a rerun the Kustomizations can already be Ready with the previous
  # image; wait until Flux has applied this one.
  for attempt in $(seq 1 60); do
    deployed="$(kubectl -n idp-system get deployment idp-web -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null || true)"
    [[ "$deployed" == "$IMAGE_REF" ]] && break
    log "Waiting for Flux to apply image $IMAGE_REF (attempt $attempt/60)"
    sleep 10
  done
  [[ "$deployed" == "$IMAGE_REF" ]] \
    || fail "idp-web still runs ${deployed:-nothing}, not $IMAGE_REF. Check: kubectl -n $FLUX_NAMESPACE describe kustomization idp"
  kubectl -n idp-system rollout status deployment/idp-web --timeout=5m
}

main() {
  require_tool az
  require_tool kubectl
  require_tool git
  require_no_az_upgrade_prompt
  validate_inputs
  resolve_gitops_source

  ensure_cluster_context
  detect_workload_arch
  ensure_namespaces
  ensure_acr
  resolve_azure_identities
  ensure_gateway_addons
  resolve_public_endpoint
  ensure_redirect_uri
  build_and_push_image
  create_app_env_secret
  write_platform_settings
  ensure_flux_configuration
  wait_for_platform

  log "Deployment complete"
  log "Image: $IMAGE_REF"
  log "Flux source: $GITOPS_REPO_URL branch $GITOPS_BRANCH (kubectl -n $FLUX_NAMESPACE get kustomizations,helmreleases)"
  log "Public URL: $NEXTAUTH_EXTERNAL_URL"
  log "Open the application at $NEXTAUTH_EXTERNAL_URL"
}

main "$@"
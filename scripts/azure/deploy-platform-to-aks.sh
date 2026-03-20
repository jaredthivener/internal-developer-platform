#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

RESOURCE_GROUP="${RESOURCE_GROUP:-idp-azure-rg}"
LOCATION="${LOCATION:-westus3}"
AKS_CLUSTER_NAME="${AKS_CLUSTER_NAME:-idp-aks-auto}"
ACR_NAME="${ACR_NAME:-}"
ACR_SKU="${ACR_SKU:-Basic}"
AZURE_PROVIDER_VERSION="${AZURE_PROVIDER_VERSION:-v1.11.0}"
SP_CREDENTIALS_FILE="${SP_CREDENTIALS_FILE:-$ROOT_DIR/.azure/${AKS_CLUSTER_NAME}-crossplane.json}"
IDP_ENV_FILE="${IDP_ENV_FILE:-$ROOT_DIR/.env.local}"
IMAGE_PLATFORM="${IMAGE_PLATFORM:-}"
IMAGE_NAME="${IMAGE_NAME:-idp-web}"
IMAGE_TAG="${IMAGE_TAG:-$(date +%Y%m%d%H%M%S)}"
SKIP_IMAGE_BUILD="${SKIP_IMAGE_BUILD:-false}"
IMAGE_REF="${IMAGE_REF:-}"
HELM_TIMEOUT="${HELM_TIMEOUT:-10m}"
WORKLOAD_ARCH="${WORKLOAD_ARCH:-}"
INGRESS_CLASS_NAME="${INGRESS_CLASS_NAME:-webapprouting.kubernetes.azure.com}"
INGRESS_SERVICE_NAMESPACE="${INGRESS_SERVICE_NAMESPACE:-app-routing-system}"
INGRESS_SERVICE_NAME="${INGRESS_SERVICE_NAME:-nginx}"
INGRESS_HOST="${INGRESS_HOST:-}"
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

get_ingress_public_ip() {
  kubectl -n "$INGRESS_SERVICE_NAMESPACE" get svc "$INGRESS_SERVICE_NAME" -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || true
}

generate_acr_name() {
  local sanitized random_suffix

  sanitized="$(printf '%s' "$AKS_CLUSTER_NAME" | tr '[:upper:]' '[:lower:]' | tr -cd '[:alnum:]')"
  sanitized="${sanitized:0:30}"
  random_suffix="$(LC_ALL=C tr -dc 'a-z0-9' </dev/urandom | head -c 6)"
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

resolve_ingress_host() {
  if [[ -n "$INGRESS_HOST" ]]; then
    log "Using explicit ingress host $INGRESS_HOST"
    return
  fi

  local ingress_ip
  ingress_ip="$(get_ingress_public_ip)"
  [[ -n "$ingress_ip" ]] || fail "Unable to determine the ingress public IP from $INGRESS_SERVICE_NAMESPACE/$INGRESS_SERVICE_NAME. Set INGRESS_HOST explicitly and rerun."

  INGRESS_HOST="idp.${ingress_ip}.sslip.io"
  log "Using derived ingress host $INGRESS_HOST"
}

resolve_nextauth_external_url() {
  if [[ -n "$NEXTAUTH_EXTERNAL_URL" ]]; then
    log "Using explicit NEXTAUTH external URL $NEXTAUTH_EXTERNAL_URL"
    return
  fi

  resolve_ingress_host
  NEXTAUTH_EXTERNAL_URL="http://$INGRESS_HOST"
  log "Using derived NEXTAUTH external URL $NEXTAUTH_EXTERNAL_URL"
}

ensure_namespaces() {
  kubectl create namespace crossplane-system --dry-run=client -o yaml | kubectl apply -f - >/dev/null
  kubectl create namespace idp-system --dry-run=client -o yaml | kubectl apply -f - >/dev/null
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

install_crossplane() {
  log "Installing Crossplane into crossplane-system"
  helm repo add crossplane-stable https://charts.crossplane.io/stable >/dev/null 2>&1 || true
  helm repo update >/dev/null

  if helm status crossplane -n crossplane-system >/dev/null 2>&1; then
    log "Removing previous Crossplane Helm release metadata before manifest-based install"
    helm uninstall crossplane -n crossplane-system >/dev/null 2>&1 || true
  fi

  helm template crossplane crossplane-stable/crossplane \
    --namespace crossplane-system \
    --values "$ROOT_DIR/platform/kubernetes/crossplane/values-aks-automatic.yaml" \
    --set rbacManager.skipAggregatedClusterRoles=true \
    | "$SCRIPT_DIR/helm-post-render-crossplane.rb" \
    | kubectl apply -f -

  kubectl -n crossplane-system rollout status deployment/crossplane --timeout=5m
  kubectl -n crossplane-system rollout status deployment/crossplane-rbac-manager --timeout=5m
}

apply_azure_providers() {
  log "Applying Azure Crossplane provider packages"
  sed "s|PROVIDER_VERSION_PLACEHOLDER|$AZURE_PROVIDER_VERSION|g" \
    "$ROOT_DIR/platform/crossplane/providers/providers.yaml" | kubectl apply -f -

  local provider
  for provider in \
    provider-azure-management \
    provider-azure-network \
    provider-azure-storage \
    provider-azure-dbforpostgresql \
    provider-azure-containerservice; do
    kubectl wait --for=condition=Healthy --timeout=10m "provider.pkg.crossplane.io/$provider"
  done
}

apply_crossplane_credentials() {
  [[ -f "$SP_CREDENTIALS_FILE" ]] || fail "Crossplane credentials file not found at $SP_CREDENTIALS_FILE. Run the bootstrap script first or set SP_CREDENTIALS_FILE."

  log "Creating Azure provider credentials secret"
  kubectl -n crossplane-system create secret generic azure-provider-creds \
    --from-file=creds="$SP_CREDENTIALS_FILE" \
    --dry-run=client -o yaml | kubectl apply -f -

  log "Applying default Crossplane deployment runtime config"
  kubectl apply -f "$ROOT_DIR/platform/crossplane/configs/default-deployment-runtime-config.yaml"

  kubectl apply -f "$ROOT_DIR/platform/crossplane/configs/provider-config.yaml"
  kubectl apply -f "$ROOT_DIR/platform/crossplane/configs/cluster-provider-config.yaml"

  sed "s|LOCATION_PLACEHOLDER|$LOCATION|g" \
    "$ROOT_DIR/platform/crossplane/examples/resourcegroup-smoke-test.yaml" | kubectl apply -f -
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

create_app_env_secret() {
  [[ -f "$IDP_ENV_FILE" ]] || fail "App environment file not found at $IDP_ENV_FILE. Create it from .env.example first."

  resolve_nextauth_external_url

  local temp_env_file
  temp_env_file="$(mktemp)"
  trap 'rm -f "$temp_env_file"' RETURN

  grep -v '^NEXTAUTH_URL=' "$IDP_ENV_FILE" > "$temp_env_file" || true
  printf 'NEXTAUTH_URL=%s\n' "$NEXTAUTH_EXTERNAL_URL" >> "$temp_env_file"

  log "Creating application env secret from $IDP_ENV_FILE with NEXTAUTH_URL=$NEXTAUTH_EXTERNAL_URL"
  kubectl -n idp-system create secret generic idp-app-env \
    --from-env-file="$temp_env_file" \
    --dry-run=client -o yaml | kubectl apply -f -
}

deploy_ingress() {
  resolve_ingress_host

  log "Deploying public ingress for host $INGRESS_HOST"
  sed -e "s|INGRESS_CLASS_NAME_PLACEHOLDER|$INGRESS_CLASS_NAME|g" \
      -e "s|INGRESS_HOST_PLACEHOLDER|$INGRESS_HOST|g" \
    "$ROOT_DIR/platform/kubernetes/idp/ingress.yaml" | kubectl apply -f -
}

deploy_idp() {
  [[ -n "$IMAGE_REF" ]] || fail "IMAGE_REF is empty. Build the image first or set IMAGE_REF."

  log "Applying IDP base resources"
  kubectl apply -f "$ROOT_DIR/platform/kubernetes/idp/base.yaml"

  create_app_env_secret

  log "Deploying IDP app"
  sed -e "s|IMAGE_PLACEHOLDER|$IMAGE_REF|g" \
      -e "s|ARCH_PLACEHOLDER|$WORKLOAD_ARCH|g" \
    "$ROOT_DIR/platform/kubernetes/idp/deployment.yaml" | kubectl apply -f -

  kubectl -n idp-system rollout status deployment/idp-web --timeout=5m
  deploy_ingress
}

main() {
  require_tool az
  require_tool kubectl
  require_tool helm

  ensure_cluster_context
  detect_workload_arch
  ensure_namespaces
  ensure_acr
  install_crossplane
  apply_azure_providers
  apply_crossplane_credentials
  build_and_push_image
  deploy_idp

  log "Deployment complete"
  log "ACR login server: $ACR_LOGIN_SERVER"
  log "Image: $IMAGE_REF"
  log "Ingress host: $INGRESS_HOST"
  log "Public URL: $NEXTAUTH_EXTERNAL_URL"
  log "Open the application at $NEXTAUTH_EXTERNAL_URL"
}

main "$@"
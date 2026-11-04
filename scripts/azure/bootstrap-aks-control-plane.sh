#!/usr/bin/env bash

set -euo pipefail

# shellcheck source=scripts/azure/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

RESOURCE_GROUP="${RESOURCE_GROUP:-idp-azure-rg}"
LOCATION="${LOCATION:-westus3}"
# Must match COMPLIANCE_ASSIGNMENT_NAME in src/lib/catalog/livePortfolio.ts.
COMPLIANCE_ASSIGNMENT_NAME="idp-mcsb-v2"
# Built-in initiative: Microsoft cloud security benchmark v2.
COMPLIANCE_INITIATIVE_ID="e3ec7e09-768c-4b64-882c-fcada3772047"
AKS_CLUSTER_NAME="${AKS_CLUSTER_NAME:-idp-aks-auto}"
CROSSPLANE_IDENTITY_NAME="${CROSSPLANE_IDENTITY_NAME:-${AKS_CLUSTER_NAME}-crossplane}"
IDP_WEB_IDENTITY_NAME="${IDP_WEB_IDENTITY_NAME:-${AKS_CLUSTER_NAME}-idp-web}"
DESIRED_STATE_STORAGE_ACCOUNT="${DESIRED_STATE_STORAGE_ACCOUNT:-}"
DESIRED_STATE_STORAGE_SKU="${DESIRED_STATE_STORAGE_SKU:-Standard_ZRS}"
DESIRED_STATE_CONTAINER="${DESIRED_STATE_CONTAINER:-desired-state}"
PORTAL_APP_NAME="${PORTAL_APP_NAME:-${AKS_CLUSTER_NAME}-portal}"
PLATFORM_KEYVAULT_NAME="${PLATFORM_KEYVAULT_NAME:-}"
ARM64_POOL_NAME="${ARM64_POOL_NAME:-spotarm64}"
# AKS Automatic enables LocalDNS, which rejects node pools under 4 vCPUs.
ARM64_VM_SIZE="${ARM64_VM_SIZE:-Standard_D4pds_v5}"
ARM64_MIN_COUNT="${ARM64_MIN_COUNT:-1}"
ARM64_MAX_COUNT="${ARM64_MAX_COUNT:-2}"
# Empty means: the newest GA minor version AKS offers in LOCATION for a new
# cluster, or the existing cluster's version on reruns.
KUBERNETES_VERSION="${KUBERNETES_VERSION:-}"
AZ_MIN_VERSION="2.77.0"
AKS_PREVIEW_MIN_VERSION="19.0.0b15"
AKS_PREVIEW_FEATURE="AKS-AutomaticHostedSystemProfilePreview"
FEATURE_REGISTRATION_TIMEOUT_SECONDS="${FEATURE_REGISTRATION_TIMEOUT_SECONDS:-900}"
FEATURE_REGISTRATION_POLL_INTERVAL_SECONDS="${FEATURE_REGISTRATION_POLL_INTERVAL_SECONDS:-15}"
CLUSTER_READY_TIMEOUT_SECONDS="${CLUSTER_READY_TIMEOUT_SECONDS:-1200}"
CLUSTER_READY_POLL_INTERVAL_SECONDS="${CLUSTER_READY_POLL_INTERVAL_SECONDS:-20}"
NODEPOOL_ADD_RETRY_COUNT="${NODEPOOL_ADD_RETRY_COUNT:-20}"
NODEPOOL_ADD_RETRY_DELAY_SECONDS="${NODEPOOL_ADD_RETRY_DELAY_SECONDS:-30}"

log() {
  printf '\n[%s] %s\n' "$(date '+%H:%M:%S')" "$*"
}

fail() {
  printf '\nERROR: %s\n' "$*" >&2
  exit 1
}

version_ge() {
  [[ "$(printf '%s\n%s\n' "$1" "$2" | sort -V | head -n1)" == "$2" ]]
}

require_az() {
  command -v az >/dev/null 2>&1 || fail "Azure CLI is required. Install it before running this script."

  local current_version
  current_version="$(az version --query '"azure-cli"' -o tsv)"
  version_ge "$current_version" "$AZ_MIN_VERSION" || fail "Azure CLI $AZ_MIN_VERSION or newer is required. Current version: $current_version"
}

ensure_extension() {
  local installed_version
  installed_version="$(az extension show --name aks-preview --query version -o tsv 2>/dev/null || true)"

  if [[ -z "$installed_version" ]]; then
    log "Installing aks-preview extension"
    az extension add --name aks-preview --allow-preview true --yes >/dev/null
    installed_version="$(az extension show --name aks-preview --query version -o tsv)"
  fi

  if ! version_ge "$installed_version" "$AKS_PREVIEW_MIN_VERSION"; then
    log "Updating aks-preview extension"
    az extension update --name aks-preview --allow-preview true >/dev/null
  fi
}

wait_for_feature_registration() {
  local elapsed=0
  local feature_state=""

  while (( elapsed < FEATURE_REGISTRATION_TIMEOUT_SECONDS )); do
    feature_state="$(az feature show --name "$AKS_PREVIEW_FEATURE" --namespace Microsoft.ContainerService --query properties.state -o tsv 2>/dev/null || true)"

    if [[ "$feature_state" == "Registered" ]]; then
      return 0
    fi

    if [[ -z "$feature_state" ]]; then
      log "Waiting for feature $AKS_PREVIEW_FEATURE to become visible"
    else
      log "Waiting for feature $AKS_PREVIEW_FEATURE registration. Current state: $feature_state"
    fi

    sleep "$FEATURE_REGISTRATION_POLL_INTERVAL_SECONDS"
    elapsed=$((elapsed + FEATURE_REGISTRATION_POLL_INTERVAL_SECONDS))
  done

  fail "Feature $AKS_PREVIEW_FEATURE did not reach Registered within ${FEATURE_REGISTRATION_TIMEOUT_SECONDS}s. Check the subscription feature state manually with: az feature show --name $AKS_PREVIEW_FEATURE --namespace Microsoft.ContainerService"
}

register_prereqs() {
  log "Registering required resource providers"
  az provider register --namespace Microsoft.ContainerService >/dev/null
  az provider register --namespace Microsoft.Network >/dev/null
  az provider register --namespace Microsoft.Compute >/dev/null
  az provider register --namespace Microsoft.ManagedIdentity >/dev/null
  # Flux configurations and the microsoft.flux cluster extension.
  az provider register --namespace Microsoft.KubernetesConfiguration >/dev/null

  log "Ensuring AKS Automatic hosted system preview feature is registered"
  az feature register \
    --name "$AKS_PREVIEW_FEATURE" \
    --namespace Microsoft.ContainerService >/dev/null 2>&1 || true

  wait_for_feature_registration

  log "Refreshing Microsoft.ContainerService provider registration"
  az provider register --namespace Microsoft.ContainerService >/dev/null
}

ensure_group() {
  log "Creating or updating resource group $RESOURCE_GROUP in $LOCATION"
  az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --output none
}

ensure_supported_vm_size() {
  log "Checking Arm64 SKU availability for $ARM64_VM_SIZE in $LOCATION"
  local vcpus
  vcpus="$(az vm list-skus --location "$LOCATION" --resource-type virtualMachines --query "[?name=='$ARM64_VM_SIZE'].capabilities[] | [?name=='vCPUs'].value | [0]" -o tsv)"
  [[ -n "$vcpus" ]] || fail "VM size $ARM64_VM_SIZE is not available in $LOCATION for this subscription. Set ARM64_VM_SIZE or LOCATION to a supported combination."
  (( vcpus >= 4 )) || fail "VM size $ARM64_VM_SIZE has $vcpus vCPUs; AKS Automatic (LocalDNS) needs at least 4. Set ARM64_VM_SIZE to a larger Arm64 size such as Standard_D4pds_v5."
}

get_existing_cluster_version() {
  az resource show \
    --resource-group "$RESOURCE_GROUP" \
    --name "$AKS_CLUSTER_NAME" \
    --resource-type Microsoft.ContainerService/managedClusters \
    --query properties.kubernetesVersion \
    -o tsv 2>/dev/null || true
}

get_cluster_provisioning_state() {
  az aks show \
    --resource-group "$RESOURCE_GROUP" \
    --name "$AKS_CLUSTER_NAME" \
    --query provisioningState \
    -o tsv 2>/dev/null || true
}

wait_for_cluster_ready() {
  local elapsed=0
  local provisioning_state=""

  while (( elapsed < CLUSTER_READY_TIMEOUT_SECONDS )); do
    provisioning_state="$(get_cluster_provisioning_state)"

    if [[ "$provisioning_state" == "Succeeded" ]]; then
      return 0
    fi

    if [[ -z "$provisioning_state" ]]; then
      log "Waiting for AKS cluster $AKS_CLUSTER_NAME to become queryable"
    else
      log "Waiting for AKS cluster $AKS_CLUSTER_NAME to become ready. Current provisioning state: $provisioning_state"
    fi

    sleep "$CLUSTER_READY_POLL_INTERVAL_SECONDS"
    elapsed=$((elapsed + CLUSTER_READY_POLL_INTERVAL_SECONDS))
  done

  fail "AKS cluster $AKS_CLUSTER_NAME did not reach Succeeded within ${CLUSTER_READY_TIMEOUT_SECONDS}s. Check the cluster state manually with: az aks show --resource-group $RESOURCE_GROUP --name $AKS_CLUSTER_NAME --query provisioningState -o tsv"
}

ensure_target_kubernetes_version() {
  local existing_version
  existing_version="$(get_existing_cluster_version)"

  if [[ -n "$existing_version" ]]; then
    if [[ -n "$KUBERNETES_VERSION" && ! "$existing_version" =~ ^${KUBERNETES_VERSION}(\.|$) ]]; then
      fail "AKS cluster $AKS_CLUSTER_NAME runs Kubernetes $existing_version, not the requested $KUBERNETES_VERSION. Upgrade it (one minor version at a time) or unset KUBERNETES_VERSION."
    fi
    KUBERNETES_VERSION="$existing_version"
    return
  fi

  if [[ -z "$KUBERNETES_VERSION" ]]; then
    KUBERNETES_VERSION="$(az aks get-versions --location "$LOCATION" --query "values[?isPreview != \`true\`].version" -o tsv | sort -V | tail -n1)"
    [[ -n "$KUBERNETES_VERSION" ]] || fail "Could not list AKS Kubernetes versions for $LOCATION."
    log "Using the newest GA Kubernetes version in $LOCATION: $KUBERNETES_VERSION"
  fi
}


# Creates (or reuses) a user-assigned managed identity that the given Kubernetes
# service account can use through AKS workload identity. No secret is issued.
# Prints the identity's principal ID.
ensure_federated_identity() {
  local identity_name="$1" namespace="$2" service_account="$3"
  local issuer

  issuer="$(az aks show --resource-group "$RESOURCE_GROUP" --name "$AKS_CLUSTER_NAME" --query oidcIssuerProfile.issuerUrl -o tsv)"
  [[ -n "$issuer" ]] || fail "AKS cluster $AKS_CLUSTER_NAME has no OIDC issuer. Enable it with: az aks update --resource-group $RESOURCE_GROUP --name $AKS_CLUSTER_NAME --enable-oidc-issuer --enable-workload-identity"

  if ! az identity show --resource-group "$RESOURCE_GROUP" --name "$identity_name" --output none 2>/dev/null; then
    log "Creating managed identity $identity_name" >&2
    az identity create --resource-group "$RESOURCE_GROUP" --name "$identity_name" --location "$LOCATION" --output none
  fi

  local subject="system:serviceaccount:$namespace:$service_account" current
  current="$(az identity federated-credential show --resource-group "$RESOURCE_GROUP" --identity-name "$identity_name" --name "$AKS_CLUSTER_NAME" --query "join(' ', [issuer, subject])" -o tsv 2>/dev/null || true)"

  # A recreated cluster gets a new OIDC issuer URL; tokens from it are only
  # accepted once the credential points at that issuer.
  if [[ -n "$current" && "$current" != "$issuer $subject" ]]; then
    log "Updating federated credential on $identity_name for the current cluster issuer" >&2
    az identity federated-credential update \
      --resource-group "$RESOURCE_GROUP" \
      --identity-name "$identity_name" \
      --name "$AKS_CLUSTER_NAME" \
      --issuer "$issuer" \
      --subject "$subject" \
      --audiences api://AzureADTokenExchange \
      --output none
  elif [[ -z "$current" ]]; then
    log "Federating $identity_name with $subject" >&2
    az identity federated-credential create \
      --resource-group "$RESOURCE_GROUP" \
      --identity-name "$identity_name" \
      --name "$AKS_CLUSTER_NAME" \
      --issuer "$issuer" \
      --subject "$subject" \
      --audiences api://AzureADTokenExchange \
      --output none
  fi

  az identity show --resource-group "$RESOURCE_GROUP" --name "$identity_name" --query principalId -o tsv
}

ensure_crossplane_identity() {
  local principal_id
  # Every Azure provider pod runs as this service account; see
  # platform/crossplane/configs/default-deployment-runtime-config.yaml.
  principal_id="$(ensure_federated_identity "$CROSSPLANE_IDENTITY_NAME" crossplane-system provider-azure)"
  ensure_role_assignment "$principal_id" Contributor "$ROLE_SCOPE"
}

ensure_desired_state_storage() {
  if [[ -z "$DESIRED_STATE_STORAGE_ACCOUNT" ]]; then
    DESIRED_STATE_STORAGE_ACCOUNT="$(az storage account list --resource-group "$RESOURCE_GROUP" --query "[?tags.\"idp-role\"=='desired-state'].name | [0]" -o tsv)"
  fi

  if [[ -z "$DESIRED_STATE_STORAGE_ACCOUNT" ]]; then
    DESIRED_STATE_STORAGE_ACCOUNT="idpstate$(openssl rand -hex 6)"
    log "Creating desired-state storage account $DESIRED_STATE_STORAGE_ACCOUNT"
    az storage account create \
      --resource-group "$RESOURCE_GROUP" \
      --name "$DESIRED_STATE_STORAGE_ACCOUNT" \
      --location "$LOCATION" \
      --sku "$DESIRED_STATE_STORAGE_SKU" \
      --kind StorageV2 \
      --min-tls-version TLS1_2 \
      --https-only true \
      --allow-blob-public-access false \
      --allow-shared-key-access false \
      --tags idp-role=desired-state \
      --output none
  fi

  # Versioning and soft delete keep the DR record recoverable after a bad write.
  az storage account blob-service-properties update \
    --resource-group "$RESOURCE_GROUP" \
    --account-name "$DESIRED_STATE_STORAGE_ACCOUNT" \
    --enable-versioning true \
    --enable-delete-retention true \
    --delete-retention-days 30 \
    --output none

  az storage container-rm create \
    --resource-group "$RESOURCE_GROUP" \
    --storage-account "$DESIRED_STATE_STORAGE_ACCOUNT" \
    --name "$DESIRED_STATE_CONTAINER" \
    --public-access off \
    --output none
}

ensure_idp_web_identity() {
  local principal_id storage_id
  principal_id="$(ensure_federated_identity "$IDP_WEB_IDENTITY_NAME" idp-system idp-web)"
  storage_id="$(az storage account show --resource-group "$RESOURCE_GROUP" --name "$DESIRED_STATE_STORAGE_ACCOUNT" --query id -o tsv)"

  ensure_role_assignment "$principal_id" "Storage Blob Data Contributor" "$storage_id"
  # Read-only ARM access for drift observation of the resources Crossplane manages.
  ensure_role_assignment "$principal_id" Reader "$ROLE_SCOPE"
  # Month-to-date cost on the portal's catalog and dashboard.
  ensure_role_assignment "$principal_id" "Cost Management Reader" "/subscriptions/$SUBSCRIPTION_ID"
}

# Scores the subscription against the Microsoft cloud security benchmark v2 for
# the portal's compliance view. Audit only: DoNotEnforce blocks and deploys
# nothing. Azure requires an identity because some member policies can
# remediate; it gets no role, so it cannot change resources even if enforcement
# is switched on later.
ensure_compliance_assignment() {
  local scope="/subscriptions/$SUBSCRIPTION_ID"

  if az policy assignment show --name "$COMPLIANCE_ASSIGNMENT_NAME" --scope "$scope" --output none 2>/dev/null; then
    return
  fi

  log "Assigning the Microsoft cloud security benchmark v2 (audit only) to $scope"
  az policy assignment create \
    --name "$COMPLIANCE_ASSIGNMENT_NAME" \
    --display-name "IDP compliance: Microsoft cloud security benchmark v2 (audit only)" \
    --policy-set-definition "$COMPLIANCE_INITIATIVE_ID" \
    --scope "$scope" \
    --enforcement-mode DoNotEnforce \
    --mi-system-assigned \
    --location "$LOCATION" \
    --output none
  # The first evaluation otherwise waits for Azure Policy's next cycle.
  az policy state trigger-scan --no-wait
}

ensure_platform_keyvault() {
  PLATFORM_KEYVAULT_NAME="$(find_platform_keyvault)"

  if [[ -z "$PLATFORM_KEYVAULT_NAME" ]]; then
    PLATFORM_KEYVAULT_NAME="idpkv$(openssl rand -hex 4)"
    log "Creating Key Vault $PLATFORM_KEYVAULT_NAME for portal secrets and TLS"
    az keyvault create \
      --resource-group "$RESOURCE_GROUP" \
      --name "$PLATFORM_KEYVAULT_NAME" \
      --location "$LOCATION" \
      --enable-rbac-authorization true \
      --tags idp-role=platform-secrets \
      --output none
  fi

  # The signed-in operator writes secrets and certificates here.
  local my_id vault_id
  my_id="$(az ad signed-in-user show --query id -o tsv)"
  vault_id="$(az keyvault show --name "$PLATFORM_KEYVAULT_NAME" --query id -o tsv)"
  if [[ "$(az role assignment list --assignee-object-id "$my_id" --scope "$vault_id" --include-inherited --query "[?roleDefinitionName=='Key Vault Administrator'] | length(@)" -o tsv)" == "0" ]]; then
    log "Granting Key Vault Administrator on $PLATFORM_KEYVAULT_NAME to the signed-in user"
    az role assignment create \
      --assignee-object-id "$my_id" \
      --assignee-principal-type User \
      --role "Key Vault Administrator" \
      --scope "$vault_id" \
      --output none
  fi
}

keyvault_secret_exists() {
  az keyvault secret show --vault-name "$PLATFORM_KEYVAULT_NAME" --name "$1" --query id -o tsv >/dev/null 2>&1
}

# Stores stdin as a Key Vault secret without putting it on a command line.
# Retries because a fresh Key Vault role assignment can take minutes to apply.
store_keyvault_secret() {
  local name="$1" value_file attempt status=1
  value_file="$(umask 077 && mktemp)"
  cat > "$value_file"

  if [[ ! -s "$value_file" ]]; then
    rm -f "$value_file"
    fail "Refusing to store an empty value as Key Vault secret $name."
  fi

  for attempt in 1 2 3 4 5 6; do
    if az keyvault secret set --vault-name "$PLATFORM_KEYVAULT_NAME" --name "$name" --file "$value_file" --output none; then
      status=0
      break
    fi
    log "Key Vault write failed (attempt $attempt/6); waiting for role assignment to propagate"
    sleep 20
  done

  rm -f "$value_file"
  [[ $status -eq 0 ]] || fail "Could not write Key Vault secret $name."
}

# Entra app registration used for portal sign-in. Only users assigned to the
# enterprise application can sign in; the operator running this is assigned.
ensure_portal_app() {
  PORTAL_APP_ID="$(find_portal_app_id)"

  if [[ -z "$PORTAL_APP_ID" ]]; then
    log "Creating Entra app registration $PORTAL_APP_NAME"
    PORTAL_APP_ID="$(az ad app create --display-name "$PORTAL_APP_NAME" --sign-in-audience AzureADMyOrg --query appId -o tsv)"
  fi

  local sp_id
  sp_id="$(az ad sp show --id "$PORTAL_APP_ID" --query id -o tsv 2>/dev/null || true)"
  if [[ -z "$sp_id" ]]; then
    sp_id="$(az ad sp create --id "$PORTAL_APP_ID" --query id -o tsv)"
  fi
  az ad sp update --id "$sp_id" --set appRoleAssignmentRequired=true --output none

  local my_id default_access_role=00000000-0000-0000-0000-000000000000
  my_id="$(az ad signed-in-user show --query id -o tsv)"
  if [[ "$(az rest --method GET --url "https://graph.microsoft.com/v1.0/servicePrincipals/$sp_id/appRoleAssignedTo" --query "length(value[?principalId=='$my_id'])" -o tsv)" == "0" ]]; then
    log "Assigning the signed-in user to $PORTAL_APP_NAME"
    az rest --method POST \
      --url "https://graph.microsoft.com/v1.0/servicePrincipals/$sp_id/appRoleAssignedTo" \
      --headers Content-Type=application/json \
      --body "{\"principalId\":\"$my_id\",\"resourceId\":\"$sp_id\",\"appRoleId\":\"$default_access_role\"}" \
      --output none
  fi

  if ! keyvault_secret_exists portal-client-secret; then
    log "Issuing a client secret for $PORTAL_APP_NAME and storing it in Key Vault"
    local client_secret
    client_secret="$(az ad app credential reset --id "$PORTAL_APP_ID" --append --display-name "$AKS_CLUSTER_NAME" --years 1 --query password -o tsv)"
    printf '%s' "$client_secret" | store_keyvault_secret portal-client-secret
    unset client_secret
  fi

  if ! keyvault_secret_exists nextauth-secret; then
    log "Generating NEXTAUTH_SECRET in Key Vault"
    openssl rand -base64 32 | tr -d '\n' | store_keyvault_secret nextauth-secret
  fi
}

create_aks_cluster() {
  local existing_version
  existing_version="$(get_existing_cluster_version)"

  if [[ -n "$existing_version" ]]; then
    log "AKS cluster $AKS_CLUSTER_NAME already exists on Kubernetes $existing_version"
    return
  fi

  log "Creating AKS Automatic cluster $AKS_CLUSTER_NAME on Kubernetes $KUBERNETES_VERSION"
  local cmd=(
    az aks create
    --resource-group "$RESOURCE_GROUP"
    --name "$AKS_CLUSTER_NAME"
    --location "$LOCATION"
    --sku automatic
    --enable-hosted-system
    --enable-oidc-issuer
    --enable-workload-identity
    --kubernetes-version "$KUBERNETES_VERSION"
    --output table
  )

  "${cmd[@]}"

  wait_for_cluster_ready
}

delete_spot_pool() {
  az aks nodepool delete \
    --resource-group "$RESOURCE_GROUP" \
    --cluster-name "$AKS_CLUSTER_NAME" \
    --name "$ARM64_POOL_NAME" \
    --output none
}

# The Arm64 Spot pool only lowers cost: AKS Automatic node auto-provisioning
# already supplies on-demand capacity. Spot capacity comes and goes, so a
# capacity error leaves the cluster without the pool instead of failing.
ensure_spot_pool() {
  local state
  state="$(az aks nodepool show \
    --resource-group "$RESOURCE_GROUP" \
    --cluster-name "$AKS_CLUSTER_NAME" \
    --name "$ARM64_POOL_NAME" \
    --query provisioningState -o tsv 2>/dev/null || true)"

  if [[ "$state" == "Failed" ]]; then
    log "Removing failed node pool $ARM64_POOL_NAME before retrying"
    delete_spot_pool
  elif [[ -n "$state" ]]; then
    log "AKS node pool $ARM64_POOL_NAME already exists ($state)"
    return
  fi

  log "Adding low-cost Arm64 Spot node pool $ARM64_POOL_NAME"
  local attempt=1
  local output=""

  while (( attempt <= NODEPOOL_ADD_RETRY_COUNT )); do
    set +e
    output="$({
      az aks nodepool add \
        --resource-group "$RESOURCE_GROUP" \
        --cluster-name "$AKS_CLUSTER_NAME" \
        --name "$ARM64_POOL_NAME" \
        --node-vm-size "$ARM64_VM_SIZE" \
        --node-count "$ARM64_MIN_COUNT" \
        --priority Spot \
        --eviction-policy Delete \
        --spot-max-price -1 \
        --ssh-access disabled \
        --mode User \
        --labels workload=platform architecture=arm64 cost=spot \
        --output table;
    } 2>&1)"
    local status=$?
    set -e

    if [[ $status -eq 0 ]]; then
      printf '%s\n' "$output"
      return 0
    fi

    if [[ "$output" == *"OperationNotAllowed"* && "$output" == *"in progress update managed cluster operation"* ]]; then
      log "AKS still has an in-flight managed update. Retrying node pool add in ${NODEPOOL_ADD_RETRY_DELAY_SECONDS}s (attempt ${attempt}/${NODEPOOL_ADD_RETRY_COUNT})."
      sleep "$NODEPOOL_ADD_RETRY_DELAY_SECONDS"
      attempt=$((attempt + 1))
      continue
    fi

    if [[ "$output" =~ SkuNotAvailable|AllocationFailed|Overconstrained ]]; then
      log "WARNING: no Spot capacity for $ARM64_VM_SIZE in $LOCATION right now. Continuing without $ARM64_POOL_NAME; node auto-provisioning supplies on-demand capacity. Rerun later (or set ARM64_VM_SIZE) to add it."
      delete_spot_pool
      return 0
    fi

    printf '%s\n' "$output" >&2
    return $status
  done

  fail "Timed out waiting to add node pool $ARM64_POOL_NAME because AKS continued reporting an in-progress managed update."
}

assign_cluster_access() {
  local aks_id current_user_id
  aks_id="$(az aks show --resource-group "$RESOURCE_GROUP" --name "$AKS_CLUSTER_NAME" --query id -o tsv)"
  current_user_id="$(az ad signed-in-user show --query id -o tsv 2>/dev/null || true)"

  if [[ -z "$current_user_id" ]]; then
    log "Skipping AKS RBAC assignment for the signed-in user because no user object ID was detected."
    return
  fi

  if [[ "$(az role assignment list --assignee "$current_user_id" --scope "$aks_id" --query "[?roleDefinitionName=='Azure Kubernetes Service RBAC Cluster Admin'] | length(@)" -o tsv)" == "0" ]]; then
    log "Assigning Azure Kubernetes Service RBAC Cluster Admin to the signed-in user"
    az role assignment create \
      --assignee-object-id "$current_user_id" \
      --assignee-principal-type User \
      --role "Azure Kubernetes Service RBAC Cluster Admin" \
      --scope "$aks_id" >/dev/null
  fi
}

get_credentials() {
  log "Fetching kubeconfig for $AKS_CLUSTER_NAME"
  az aks get-credentials \
    --resource-group "$RESOURCE_GROUP" \
    --name "$AKS_CLUSTER_NAME" \
    --overwrite-existing >/dev/null

  if command -v kubectl >/dev/null 2>&1; then
    wait_for_cluster_authorization
    kubectl create namespace crossplane-system --dry-run=client -o yaml | kubectl_apply >/dev/null
    kubectl create namespace idp-system --dry-run=client -o yaml | kubectl_apply >/dev/null
    log "Ensured namespaces crossplane-system and idp-system exist"
  else
    log "kubectl is not installed. Skipping namespace bootstrap."
  fi
}

main() {
  require_no_az_upgrade_prompt
  require_az
  ensure_extension

  SUBSCRIPTION_ID="$(az account show --query id -o tsv)"
  # Contributor for Crossplane (it creates resource groups), Reader for the portal.
  ROLE_SCOPE="${CROSSPLANE_ROLE_SCOPE:-/subscriptions/$SUBSCRIPTION_ID}"

  register_prereqs
  ensure_group
  ensure_supported_vm_size
  ensure_target_kubernetes_version
  create_aks_cluster
  ensure_spot_pool
  ensure_crossplane_identity
  ensure_desired_state_storage
  ensure_idp_web_identity
  ensure_compliance_assignment
  ensure_platform_keyvault
  ensure_portal_app
  assign_cluster_access
  get_credentials

  log "Bootstrap complete"
  log "Resource group: $RESOURCE_GROUP"
  log "AKS cluster: $AKS_CLUSTER_NAME"
  log "Crossplane identity: $CROSSPLANE_IDENTITY_NAME"
  log "IDP web identity: $IDP_WEB_IDENTITY_NAME"
  log "Desired-state storage: $DESIRED_STATE_STORAGE_ACCOUNT/$DESIRED_STATE_CONTAINER"
  log "Key Vault: $PLATFORM_KEYVAULT_NAME"
  log "Portal app registration: $PORTAL_APP_NAME ($PORTAL_APP_ID)"
}

main "$@"
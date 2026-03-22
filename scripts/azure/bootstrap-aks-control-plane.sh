#!/usr/bin/env bash

set -euo pipefail

RESOURCE_GROUP="${RESOURCE_GROUP:-idp-azure-rg}"
LOCATION="${LOCATION:-westus3}"
AKS_CLUSTER_NAME="${AKS_CLUSTER_NAME:-idp-aks-auto}"
CROSSPLANE_SPN_NAME="${CROSSPLANE_SPN_NAME:-${AKS_CLUSTER_NAME}-crossplane}"
ARM64_POOL_NAME="${ARM64_POOL_NAME:-spotarm64}"
ARM64_VM_SIZE="${ARM64_VM_SIZE:-Standard_D2pds_v5}"
ARM64_MIN_COUNT="${ARM64_MIN_COUNT:-1}"
ARM64_MAX_COUNT="${ARM64_MAX_COUNT:-2}"
KUBERNETES_VERSION="${KUBERNETES_VERSION:-1.34}"
SP_OUTPUT_FILE="${SP_OUTPUT_FILE:-.azure/${AKS_CLUSTER_NAME}-crossplane.json}"
ROTATE_SPN_SECRET="${ROTATE_SPN_SECRET:-false}"
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
  local available
  available="$(az vm list-skus --location "$LOCATION" --resource-type virtualMachines --query "[?name=='$ARM64_VM_SIZE'].name | [0]" -o tsv)"
  [[ "$available" == "$ARM64_VM_SIZE" ]] || fail "VM size $ARM64_VM_SIZE is not available in $LOCATION for this subscription. Set ARM64_VM_SIZE or LOCATION to a supported combination."
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

  if [[ -n "$existing_version" && ! "$existing_version" =~ ^${KUBERNETES_VERSION}(\.|$) ]]; then
    fail "AKS cluster $AKS_CLUSTER_NAME already exists on Kubernetes $existing_version, but this platform is pinned to Kubernetes $KUBERNETES_VERSION because @kubernetes/client-node currently supports up to Kubernetes v1.34. Recreate or upgrade/downgrade the cluster to the 1.34 minor line before deploying the IDP."
  fi
}

ensure_crossplane_spn() {
  local existing_app_id existing_object_id role_scope
  role_scope="${CROSSPLANE_ROLE_SCOPE:-/subscriptions/$SUBSCRIPTION_ID}"

  existing_app_id="$(az ad sp list --display-name "$CROSSPLANE_SPN_NAME" --query '[0].appId' -o tsv 2>/dev/null || true)"

  if [[ -z "$existing_app_id" ]]; then
    log "Creating service principal $CROSSPLANE_SPN_NAME for Crossplane or platform automation"
    read -r CROSSPLANE_APP_ID CROSSPLANE_PASSWORD CROSSPLANE_TENANT <<< "$(az ad sp create-for-rbac \
      --name "$CROSSPLANE_SPN_NAME" \
      --skip-assignment \
      --query '[appId,password,tenant]' \
      -o tsv)"
  else
    CROSSPLANE_APP_ID="$existing_app_id"
    CROSSPLANE_TENANT="$(az account show --query tenantId -o tsv)"

    if [[ "$ROTATE_SPN_SECRET" == "true" ]]; then
      log "Rotating client secret for existing service principal $CROSSPLANE_SPN_NAME"
      CROSSPLANE_PASSWORD="$(az ad app credential reset --id "$CROSSPLANE_APP_ID" --query password -o tsv)"
    else
      CROSSPLANE_PASSWORD=""
      log "Service principal $CROSSPLANE_SPN_NAME already exists. Keeping the current secret unchanged."
    fi
  fi

  existing_object_id="$(az ad sp show --id "$CROSSPLANE_APP_ID" --query id -o tsv)"

  if [[ "$(az role assignment list --assignee "$CROSSPLANE_APP_ID" --scope "$role_scope" --query "[?roleDefinitionName=='Contributor'] | length(@)" -o tsv)" == "0" ]]; then
    log "Assigning Contributor on $role_scope to service principal"
    az role assignment create \
      --assignee-object-id "$existing_object_id" \
      --assignee-principal-type ServicePrincipal \
      --role Contributor \
      --scope "$role_scope" >/dev/null
  fi

  if [[ -n "$SP_OUTPUT_FILE" && -n "$CROSSPLANE_PASSWORD" ]]; then
    mkdir -p "$(dirname "$SP_OUTPUT_FILE")"
    umask 177
    cat > "$SP_OUTPUT_FILE" <<EOF
{
  "clientId": "$CROSSPLANE_APP_ID",
  "clientSecret": "$CROSSPLANE_PASSWORD",
  "tenantId": "$CROSSPLANE_TENANT",
  "subscriptionId": "$SUBSCRIPTION_ID"
}
EOF
    log "Wrote service principal credentials to $SP_OUTPUT_FILE"
  elif [[ -n "$SP_OUTPUT_FILE" ]]; then
    log "SP_OUTPUT_FILE is set to $SP_OUTPUT_FILE, but no new secret was generated. Set ROTATE_SPN_SECRET=true if you need a fresh Crossplane credentials file."
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
    --generate-ssh-keys
    --kubernetes-version "$KUBERNETES_VERSION"
    --output table
  )

  "${cmd[@]}"

  wait_for_cluster_ready
}

ensure_spot_pool() {
  if az aks nodepool show \
    --resource-group "$RESOURCE_GROUP" \
    --cluster-name "$AKS_CLUSTER_NAME" \
    --name "$ARM64_POOL_NAME" \
    --output none >/dev/null 2>&1; then
    log "AKS node pool $ARM64_POOL_NAME already exists"
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
    kubectl create namespace crossplane-system --dry-run=client -o yaml | kubectl apply -f - >/dev/null
    kubectl create namespace idp-system --dry-run=client -o yaml | kubectl apply -f - >/dev/null
    log "Ensured namespaces crossplane-system and idp-system exist"
  else
    log "kubectl is not installed. Skipping namespace bootstrap."
  fi
}

main() {
  require_az
  ensure_extension

  SUBSCRIPTION_ID="$(az account show --query id -o tsv)"

  register_prereqs
  ensure_group
  ensure_supported_vm_size
  ensure_target_kubernetes_version
  ensure_crossplane_spn
  create_aks_cluster
  ensure_spot_pool
  assign_cluster_access
  get_credentials

  log "Bootstrap complete"
  log "Resource group: $RESOURCE_GROUP"
  log "AKS cluster: $AKS_CLUSTER_NAME"
  log "Crossplane service principal appId: $CROSSPLANE_APP_ID"
}

main "$@"
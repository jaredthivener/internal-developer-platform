#!/usr/bin/env bash
# Removes everything `npm run azure:up` creates. Order matters:
#  1. Azure resources Crossplane manages are deleted through Crossplane while
#     the cluster still runs, with Flux suspended so it cannot recreate them.
#  2. Role assignments go before the identities, or they are left behind as
#     orphans at subscription scope.
#  3. The Key Vault is purged after its resource group is gone (soft delete).
# Run: npm run azure:down            (asks for confirmation)
#      npm run azure:down -- --yes   (no prompt)

set -euo pipefail

# shellcheck source=scripts/azure/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

RESOURCE_GROUP="${RESOURCE_GROUP:-idp-azure-rg}"
LOCATION="${LOCATION:-westus3}"
AKS_CLUSTER_NAME="${AKS_CLUSTER_NAME:-idp-aks-auto}"
CROSSPLANE_IDENTITY_NAME="${CROSSPLANE_IDENTITY_NAME:-${AKS_CLUSTER_NAME}-crossplane}"
IDP_WEB_IDENTITY_NAME="${IDP_WEB_IDENTITY_NAME:-${AKS_CLUSTER_NAME}-idp-web}"
PORTAL_APP_NAME="${PORTAL_APP_NAME:-${AKS_CLUSTER_NAME}-portal}"
PLATFORM_KEYVAULT_NAME="${PLATFORM_KEYVAULT_NAME:-}"
# Must match COMPLIANCE_ASSIGNMENT_NAME in bootstrap-aks-control-plane.sh.
COMPLIANCE_ASSIGNMENT_NAME="idp-mcsb-v2"
FLUX_NAMESPACE=cluster-config
MANAGED_RESOURCE_TIMEOUT="${MANAGED_RESOURCE_TIMEOUT:-20m}"
# Set when the cluster is broken and its Crossplane-managed Azure resources
# have been removed (or are to be kept) some other way.
SKIP_MANAGED_RESOURCE_CLEANUP="${SKIP_MANAGED_RESOURCE_CLEANUP:-false}"
ASSUME_YES=false
[[ "${1:-}" == "--yes" ]] && ASSUME_YES=true

log() {
  printf '\n[%s] %s\n' "$(date '+%H:%M:%S')" "$*"
}

fail() {
  printf '\nERROR: %s\n' "$*" >&2
  exit 1
}

confirm() {
  log "This permanently deletes, in subscription $SUBSCRIPTION_ID:"
  printf '  - Azure resources Crossplane manages in cluster %s (portal-created resources included)\n' "$AKS_CLUSTER_NAME"
  printf '  - every role assignment of identities %s and %s\n' "$CROSSPLANE_IDENTITY_NAME" "$IDP_WEB_IDENTITY_NAME"
  printf '  - policy assignment %s and Entra app registration %s (purged)\n' "$COMPLIANCE_ASSIGNMENT_NAME" "$PORTAL_APP_NAME"
  printf '  - resource group %s with everything in it; its Key Vault is purged\n' "$RESOURCE_GROUP"
  printf '  - the cluster'"'"'s default Azure Monitor workspace, if nothing else uses it\n'
  [[ "$ASSUME_YES" == true ]] && return
  local answer
  read -r -p "Type the resource group name ($RESOURCE_GROUP) to continue: " answer
  [[ "$answer" == "$RESOURCE_GROUP" ]] || fail "Not confirmed; nothing was deleted."
}

lower() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]'
}

cluster_exists() {
  az aks show --resource-group "$RESOURCE_GROUP" --name "$AKS_CLUSTER_NAME" --output none 2>/dev/null
}

# Flux would re-apply the smoke-test ResourceGroup as soon as it is deleted.
suspend_flux() {
  local ks
  for ks in $(kubectl -n "$FLUX_NAMESPACE" get kustomizations.kustomize.toolkit.fluxcd.io -o name 2>/dev/null); do
    kubectl -n "$FLUX_NAMESPACE" patch "$ks" --type merge -p '{"spec":{"suspend":true}}' >/dev/null
  done
  log "Suspended Flux Kustomizations in $FLUX_NAMESPACE"
}

# Deleting a managed resource makes its provider delete the Azure resource;
# the object is gone only once Azure confirms. Fails rather than leaving Azure
# resources behind that nothing tracks any more.
delete_managed_resources() {
  if [[ "$SKIP_MANAGED_RESOURCE_CLEANUP" == true ]]; then
    log "SKIP_MANAGED_RESOURCE_CLEANUP=true: leaving Crossplane-managed Azure resources in place"
    return
  fi
  if ! cluster_exists; then
    log "Cluster $AKS_CLUSTER_NAME does not exist; no Crossplane-managed resources to delete"
    return
  fi

  az aks get-credentials --resource-group "$RESOURCE_GROUP" --name "$AKS_CLUSTER_NAME" --overwrite-existing >/dev/null
  wait_for_cluster_authorization
  if [[ -z "$(kubectl api-resources --categories managed -o name 2>/dev/null)" ]]; then
    log "Crossplane is not installed; no managed resources to delete"
    return
  fi

  suspend_flux
  log "Deleting Crossplane-managed Azure resources (waits up to $MANAGED_RESOURCE_TIMEOUT)"
  kubectl delete managed --all --all-namespaces --wait=true --timeout="$MANAGED_RESOURCE_TIMEOUT" || true

  local remaining
  remaining="$(kubectl get managed --all-namespaces -o name 2>/dev/null || true)"
  [[ -z "$remaining" ]] \
    || fail "Crossplane has not deleted these yet (check: kubectl describe <name>):
$remaining
Rerun once they are gone, or set SKIP_MANAGED_RESOURCE_CLEANUP=true to leave their Azure resources behind."
}

# Assignments at any scope; those inside the resource group would go with it,
# but subscription-scope ones (Contributor, Reader, Cost Management Reader)
# would stay behind as orphans.
delete_identity_role_assignments() {
  local name principal_id ids
  for name in "$CROSSPLANE_IDENTITY_NAME" "$IDP_WEB_IDENTITY_NAME"; do
    principal_id="$(az identity show --resource-group "$RESOURCE_GROUP" --name "$name" --query principalId -o tsv 2>/dev/null || true)"
    [[ -n "$principal_id" ]] || continue
    ids="$(az role assignment list --all --assignee-object-id "$principal_id" --query '[].id' -o tsv)"
    [[ -n "$ids" ]] || continue
    log "Deleting $(grep -c . <<<"$ids") role assignment(s) of $name"
    # shellcheck disable=SC2086 # one argument per assignment ID
    az role assignment delete --ids $ids --output none
  done
}

delete_compliance_assignment() {
  local scope="/subscriptions/$SUBSCRIPTION_ID"
  if az policy assignment show --name "$COMPLIANCE_ASSIGNMENT_NAME" --scope "$scope" --output none 2>/dev/null; then
    log "Deleting policy assignment $COMPLIANCE_ASSIGNMENT_NAME"
    az policy assignment delete --name "$COMPLIANCE_ASSIGNMENT_NAME" --scope "$scope"
  fi
}

# Deleted app registrations stay restorable for 30 days unless purged.
delete_portal_app() {
  local app_id object_id
  app_id="$(find_portal_app_id)"
  [[ -n "$app_id" ]] || return 0
  object_id="$(az ad app show --id "$app_id" --query id -o tsv)"
  log "Deleting and purging Entra app registration $PORTAL_APP_NAME ($app_id)"
  az ad app delete --id "$app_id"
  az rest --method DELETE --url "https://graph.microsoft.com/v1.0/directory/deletedItems/$object_id" --output none
}

# The Azure Monitor workspace AKS Automatic creates for managed Prometheus,
# read from the cluster's data collection rules before they are deleted.
find_monitor_workspaces() {
  local dcr
  for dcr in $(az resource list --resource-group "$RESOURCE_GROUP" --resource-type Microsoft.Insights/dataCollectionRules --query '[].id' -o tsv 2>/dev/null); do
    az resource show --ids "$dcr" --query 'properties.destinations.monitoringAccounts[].accountResourceId' -o tsv
  done | sort -u
}

delete_resource_group() {
  if [[ "$(az group exists --name "$RESOURCE_GROUP")" != true ]]; then
    log "Resource group $RESOURCE_GROUP does not exist"
    return
  fi
  log "Deleting resource group $RESOURCE_GROUP (the cluster's node resource group goes with it)"
  az group delete --name "$RESOURCE_GROUP" --yes
}

purge_keyvault() {
  local name="$1"
  [[ -n "$name" ]] || return 0
  if [[ "$(az keyvault show-deleted --name "$name" --query 'properties.purgeProtectionEnabled' -o tsv 2>/dev/null)" == true ]]; then
    log "Key Vault $name has purge protection; it is deleted but cannot be purged before its retention ends"
    return
  fi
  if az keyvault show-deleted --name "$name" --output none 2>/dev/null; then
    log "Purging Key Vault $name"
    az keyvault purge --name "$name" --location "$LOCATION"
  fi
}

# Only AKS's default workspace (DefaultAzureMonitorWorkspace-*), and only when
# no remaining data collection rule in the subscription sends to it. Its
# managed MA_* resource group is removed by Azure with it.
delete_unused_monitor_workspace() {
  local workspace="$1" dcr group
  [[ "$(lower "$workspace")" == */providers/microsoft.monitor/accounts/defaultazuremonitorworkspace-* ]] || return 0
  [[ "$(az resource show --ids "$workspace" --query id -o tsv 2>/dev/null)" != "" ]] || return 0

  for dcr in $(az resource list --resource-type Microsoft.Insights/dataCollectionRules --query '[].id' -o tsv); do
    if az resource show --ids "$dcr" --query 'properties.destinations.monitoringAccounts[].accountResourceId' -o tsv | grep -qiFx "$workspace"; then
      log "Keeping $workspace: still used by $dcr"
      return
    fi
  done

  log "Deleting unused Azure Monitor workspace $workspace"
  az resource delete --ids "$workspace"
  group="$(cut -d/ -f5 <<<"$workspace")"
  if [[ "$(lower "$group")" == defaultresourcegroup-* && "$(az resource list --resource-group "$group" --query 'length(@)' -o tsv)" == 0 ]]; then
    log "Deleting empty resource group $group"
    az group delete --name "$group" --yes
  fi
}

remove_kubeconfig_entries() {
  kubectl config delete-context "$AKS_CLUSTER_NAME" >/dev/null 2>&1 || true
  kubectl config delete-cluster "$AKS_CLUSTER_NAME" >/dev/null 2>&1 || true
  kubectl config delete-user "clusterUser_${RESOURCE_GROUP}_${AKS_CLUSTER_NAME}" >/dev/null 2>&1 || true
}

main() {
  command -v az >/dev/null || fail "az is required."
  command -v kubectl >/dev/null || fail "kubectl is required."
  require_no_az_upgrade_prompt
  SUBSCRIPTION_ID="$(az account show --query id -o tsv)"
  confirm

  delete_managed_resources
  delete_identity_role_assignments
  delete_compliance_assignment
  delete_portal_app

  local keyvault="" workspaces=""
  if [[ "$(az group exists --name "$RESOURCE_GROUP")" == true ]]; then
    keyvault="$(find_platform_keyvault)"
    workspaces="$(find_monitor_workspaces)"
  fi
  delete_resource_group
  purge_keyvault "$keyvault"
  local workspace
  for workspace in $workspaces; do
    delete_unused_monitor_workspace "$workspace"
  done
  remove_kubeconfig_entries

  log "Teardown complete"
}

main "$@"

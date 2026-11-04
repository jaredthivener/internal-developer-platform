# shellcheck shell=bash
# Helpers shared by the Azure bootstrap and deploy scripts. Source, don't run.

# A pending `az` auto-upgrade prompt is invisible when output is piped (for
# example through tee) and blocks the run forever. Read the CLI config file
# directly, because any `az` call could itself trigger the prompt.
require_no_az_upgrade_prompt() {
  local config="${AZURE_CONFIG_DIR:-$HOME/.azure}/config"
  [[ -f "$config" ]] || return 0

  local read_setting='/^\[/{section=$1} section=="[auto-upgrade]" && $1==key {print $2}'
  local enable prompt
  enable="$(awk -F' *= *' -v key=enable "$read_setting" "$config")"
  prompt="$(awk -F' *= *' -v key=prompt "$read_setting" "$config")"

  if [[ "$enable" =~ ^(yes|true|1)$ && ! "$prompt" =~ ^(no|false|0)$ ]]; then
    fail "Azure CLI auto-upgrade would prompt and hang this script. Run: az config set auto-upgrade.enable=no"
  fi
}

# The Key Vault that holds the portal's secrets and TLS certificate, found by
# tag so reruns reuse it. Prints its name, or nothing when none exists yet.
find_platform_keyvault() {
  if [[ -n "${PLATFORM_KEYVAULT_NAME:-}" ]]; then
    printf '%s' "$PLATFORM_KEYVAULT_NAME"
    return
  fi
  az keyvault list --resource-group "$RESOURCE_GROUP" \
    --query "[?tags.\"idp-role\"=='platform-secrets'].name | [0]" -o tsv
}

# Finds the portal's Entra app registration by display name. Prints its appId,
# or nothing when it does not exist. Fails if the name is ambiguous.
find_portal_app_id() {
  local app_ids
  app_ids="$(az ad app list --display-name "$PORTAL_APP_NAME" --query '[].appId' -o tsv)"
  if [[ "$(printf '%s\n' "$app_ids" | grep -c .)" -gt 1 ]]; then
    fail "More than one Entra app registration is named $PORTAL_APP_NAME. Set PORTAL_APP_NAME to a unique name."
  fi
  printf '%s' "$app_ids"
}

# A new cluster, or a freshly granted Azure RBAC role, can answer with
# authorization-webhook timeouts for several minutes. Waits until the
# signed-in user can create namespaces before any kubectl write.
wait_for_cluster_authorization() {
  local attempt
  for attempt in $(seq 1 30); do
    if [[ "$(kubectl auth can-i create namespaces 2>/dev/null)" == "yes" ]]; then
      return 0
    fi
    log "Waiting for Kubernetes API authorization (attempt $attempt/30)"
    sleep 20
  done
  fail "Kubernetes API still refuses or times out after 10 minutes. Check the Azure Kubernetes Service RBAC Cluster Admin role assignment for your account."
}

# `kubectl apply -f -` that survives the Azure RBAC authorization webhook
# ("guard") timing out, which fails individual objects with InternalError even
# after wait_for_cluster_authorization passed. Apply is idempotent, so the
# manifest (read from stdin) is re-sent; any other error fails at once.
kubectl_apply() {
  local manifest output attempt
  manifest="$(cat)"
  for attempt in 1 2 3 4 5; do
    if output="$(printf '%s\n' "$manifest" | kubectl apply "$@" -f - 2>&1)"; then
      printf '%s\n' "$output"
      return 0
    fi
    printf '%s\n' "$output" >&2
    if ! grep -q -E 'InternalError|Client\.Timeout exceeded|TLS handshake timeout|i/o timeout' <<<"$output"; then
      return 1
    fi
    log "Transient Kubernetes API error; retrying apply (attempt $attempt/5)"
    sleep 15
  done
  return 1
}

ensure_role_assignment() {
  local principal_id="$1" role="$2" scope="$3"

  if [[ "$(az role assignment list --assignee-object-id "$principal_id" --role "$role" --scope "$scope" --query 'length(@)' -o tsv)" == "0" ]]; then
    log "Assigning $role on $scope"
    az role assignment create \
      --assignee-object-id "$principal_id" \
      --assignee-principal-type ServicePrincipal \
      --role "$role" \
      --scope "$scope" \
      --output none
  fi
}

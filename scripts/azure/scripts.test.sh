#!/usr/bin/env bash
# Exercises the Azure bootstrap/deploy script functions without touching Azure
# or a cluster: `az`, `kubectl` and `sleep` are stubbed and every az call is
# logged so assertions can check what would have been sent.
# Run: bash scripts/azure/scripts.test.sh

set -uo pipefail

AZURE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK_DIR="$(mktemp -d)"
export WORK_DIR
trap 'rm -rf "$WORK_DIR"' EXIT
mkdir -p "$WORK_DIR/tmp"
failures=0

# run <script> <snippet>: sources the script's functions (without running main)
# under set -euo pipefail with stubs, then evals the snippet. Prints combined
# output; returns the snippet's status. Stub behavior is driven by STUB_* env.
run() {
  TMPDIR="$WORK_DIR/tmp" AZURE_CONFIG_DIR="$WORK_DIR/azcfg" bash -c '
    set -euo pipefail
    source <(sed -e "/^main \"\$@\"$/d" -e "s|^SCRIPT_DIR=.*|SCRIPT_DIR=$2|" \
                 -e "s|^source \"\$(cd .*common.sh\"$|source $2/common.sh|" "$2/$1")
    sleep() { :; }
    kubectl() {
      printf "%s\n" "$*" >> "$WORK_DIR/kubectl.log"
      printf "kubectl %s\n" "$*" >> "$WORK_DIR/calls.log"
      local arg
      for arg in "$@"; do
        [[ "$arg" == --from-env-file=* ]] && cp "${arg#--from-env-file=}" "$WORK_DIR/secret.env"
      done
      if [[ "$*" == "apply -f -" && "$(cat "$WORK_DIR/apply-fails" 2>/dev/null || echo 0)" -gt 0 ]]; then
        echo $(( $(cat "$WORK_DIR/apply-fails") - 1 )) > "$WORK_DIR/apply-fails"
        cat >/dev/null; printf "%s\n" "$STUB_APPLY_ERROR" >&2; return 1
      fi
      [[ "$*" == "apply -f -" ]] && { cat >> "$WORK_DIR/applied.yaml"; echo "---" >> "$WORK_DIR/applied.yaml"; }
      [[ "$*" == *"get deployment idp-web"* ]] && printf "%s" "${STUB_DEPLOYED_IMAGE:-}"
      [[ "$*" == "auth can-i"* ]] && echo yes
      [[ "$*" == "api-resources --categories managed"* ]] && printf "%s" "${STUB_MANAGED_TYPES-resourcegroups.azure.m.upbound.io}"
      [[ "$*" == *"get kustomizations"* ]] && printf "%s" "${STUB_KUSTOMIZATIONS-kustomization.kustomize.toolkit.fluxcd.io/idp}"
      [[ "$*" == "get managed"* ]] && printf "%s" "${STUB_REMAINING_MANAGED:-}"
      return 0
    }
    git() {
      printf "%s\n" "$*" >> "$WORK_DIR/git.log"
      case "$*" in
        *"remote get-url origin") echo "${STUB_GIT_ORIGIN:-https://github.com/o/idp.git}" ;;
        *"rev-parse --abbrev-ref HEAD") echo "${STUB_GIT_BRANCH:-feature}" ;;
        *"rev-parse HEAD") echo "${STUB_GIT_HEAD:-abc123}" ;;
        *"ls-remote"*) [[ -n "${STUB_GIT_REMOTE_SHA-abc123}" ]] && printf "%s\trefs/heads/x\n" "${STUB_GIT_REMOTE_SHA-abc123}" ;;
        *"status --porcelain"*) printf "%s" "${STUB_GIT_DIRTY:-}" ;;
      esac
      return 0
    }
    az() {
      printf "%s\n" "$*" >> "$WORK_DIR/az.log"
      printf "az %s\n" "$*" >> "$WORK_DIR/calls.log"
      case "$*" in
        "account show"*) echo sub1 ;;
        "aks show --resource-group rg --name c --output none") [[ "${STUB_CLUSTER:-yes}" == yes ]] ;;
        "group exists"*) echo "${STUB_GROUP_EXISTS:-true}" ;;
        "role assignment list --all --assignee-object-id"*) printf "%s" "${STUB_ROLE_IDS-$'"'"'/ra/1\n/ra/2'"'"'}" ;;
        "ad app show"*"--query id"*) echo app-object-id ;;
        "keyvault show-deleted"*purgeProtection*) echo "${STUB_PURGE_PROTECTION:-}" ;;
        "keyvault show-deleted"*) [[ "${STUB_KV_DELETED:-yes}" == yes ]] ;;
        "resource list --resource-group rg --resource-type"*) printf "%s" "${STUB_RG_DCRS-/rg/dcr}" ;;
        "resource list --resource-type"*) printf "%s" "${STUB_ALL_DCRS:-}" ;;
        "resource list --resource-group"*"length(@)"*) echo "${STUB_GROUP_RESOURCES:-0}" ;;
        "resource show --ids"*monitoringAccounts*) printf "%s" "${STUB_WORKSPACE-/subscriptions/sub1/resourceGroups/DefaultResourceGroup-westus3/providers/microsoft.monitor/accounts/DefaultAzureMonitorWorkspace-westus3}" ;;
        "resource show --ids "*"--query id"*) a="$*"; a="${a#resource show --ids }"; echo "${a%% *}" ;;
        "ad signed-in-user show"*) echo user-oid ;;
        "ad app list"*) printf "%s" "${STUB_APP_IDS:-}" ;;
        "ad app create"*) echo new-app-id ;;
        "ad app show"*) printf "%s" "${STUB_REDIRECT_URIS:-}" ;;
        "ad sp show"*) printf "%s" "${STUB_SP_ID:-}" ;;
        "ad sp create"*) echo sp-oid ;;
        "ad app credential reset"*) printf "%s" "${STUB_CLIENT_SECRET-s3cret-from-entra}" ;;
        "rest --method GET"*) echo "${STUB_ASSIGNED:-0}" ;;
        "keyvault list"*) printf "%s" "${STUB_KEYVAULT:-}" ;;
        "keyvault show"*) echo /subscriptions/s/vaults/kv ;;
        "keyvault secret show"*"--query id"*) [[ "${STUB_SECRETS_EXIST:-no}" == yes ]] ;;
        "keyvault secret show"*"nextauth-secret"*) printf "%s" "${STUB_NEXTAUTH-nextauth-value}" ;;
        "keyvault secret show"*"portal-client-secret"*) printf "%s" "${STUB_PORTAL_SECRET-portal-value}" ;;
        "keyvault secret set"*)
          local args="$*" file; file="${args##*--file }"; file="${file%% *}"
          printf "%s=%s\n" "$(sed -E "s/.*--name ([^ ]+).*/\1/" <<<"$*")" "$(cat "$file")" >> "$WORK_DIR/kv-writes"
          ;;
        "role assignment list"*) echo "${STUB_ROLE_COUNT:-1}" ;;
        "policy assignment show"*) [[ "${STUB_POLICY_ASSIGNED:-yes}" == yes ]] ;;
        "k8s-configuration flux show"*) [[ "${STUB_FLUX_CONFIG:-yes}" == yes ]] ;;
        "vm list-skus"*) printf "%s" "${STUB_VCPUS:-}" ;;
        "aks get-versions"*) printf "%s" "${STUB_VERSIONS:-}" ;;
        "resource show"*) printf "%s" "${STUB_EXISTING_VERSION:-}" ;;
        "aks show"*oidcIssuerProfile*) echo "${STUB_ISSUER:-https://issuer.new/}" ;;
        "aks show"*gatewayApi*) echo "${STUB_ADDON_STATE:-null null null null}" ;;
        "aks approuting defaultdomain show"*) printf "%s" "${STUB_DOMAIN-0123456789abcdef01234567.westus3.aksapp.io}" ;;
        "feature show"*) echo Registered ;;
        "identity federated-credential show"*) [[ -n "${STUB_FIC:-}" ]] && echo "$STUB_FIC" ;;
        "identity show"*) echo principal-oid ;;
        "aks nodepool show"*) printf "%s" "${STUB_POOL_STATE:-}" ;;
        "aks nodepool add"*) printf "%s" "${STUB_ADD_OUTPUT:-}"; return "${STUB_ADD_STATUS:-0}" ;;
      esac
    }
    eval "$3"
  ' _ "$1" "$AZURE_DIR" "$2" 2>&1
}

reset_logs() { rm -f "$WORK_DIR"/calls.log "$WORK_DIR"/az.log "$WORK_DIR"/kubectl.log "$WORK_DIR"/git.log "$WORK_DIR"/applied.yaml "$WORK_DIR"/kv-writes "$WORK_DIR"/secret.env "$WORK_DIR"/policy.json; }

check() { # description, condition (evaluated), [context to print on failure]
  if eval "$2"; then
    printf 'ok:   %s\n' "$1"
  else
    printf 'FAIL: %s\n%s\n' "$1" "${3:-}"
    failures=$((failures + 1))
  fi
}

DEPLOY=deploy-platform-to-aks.sh
BOOTSTRAP=bootstrap-aks-control-plane.sh

# --- deploy: input validation -------------------------------------------------
out="$(NEXTAUTH_EXTERNAL_URL=http://idp.example.com run $DEPLOY validate_inputs)"
check 'rejects an http NEXTAUTH URL' '[[ $? -ne 0 && "$out" == *"must use https"* ]]' "$out"
out="$(run $DEPLOY 'validate_inputs && echo valid')"
check 'accepts defaults (no host)' '[[ "$out" == *valid ]]' "$out"
out="$(run $DEPLOY 'declare -p TLS_CERT_KEYVAULT_URI TLS_ISSUER 2>&1; declare -F ensure_tls_certificate deploy_gateway install_crossplane ensure_cert_manager')"
check 'the Key Vault TLS path and imperative installs are gone' \
  '[[ "$out" != *"declare -"* && "$out" != *ensure_tls_certificate* && "$out" != *deploy_gateway* && "$out" != *install_crossplane* && "$out" != *ensure_cert_manager* ]]' "$out"

# --- deploy: GitOps source ----------------------------------------------------
# Flux deploys what is on the remote, so a local checkout that differs from it
# would silently deploy something else.
out="$(run $DEPLOY 'resolve_gitops_source && echo "src=$GITOPS_REPO_URL@$GITOPS_BRANCH"')"
check 'defaults to the origin repository and the checked-out branch when it is pushed' \
  '[[ "$out" == *"src=https://github.com/o/idp.git@feature" ]] && grep -q "ls-remote https://github.com/o/idp.git refs/heads/feature" "$WORK_DIR/git.log"' "$out"
out="$(STUB_GIT_HEAD=local-only run $DEPLOY resolve_gitops_source)"
check 'refuses unpushed commits on the tracked branch' '[[ $? -ne 0 && "$out" == *"Commit and push"* ]]' "$out"
out="$(STUB_GIT_DIRTY=' M platform/kubernetes/idp/deployment.yaml' run $DEPLOY resolve_gitops_source)"
check 'refuses uncommitted platform/ changes' '[[ $? -ne 0 && "$out" == *"Commit and push"* ]]' "$out"
out="$(STUB_GIT_REMOTE_SHA='' run $DEPLOY resolve_gitops_source)"
check 'refuses a branch that is not on the remote' '[[ $? -ne 0 && "$out" == *"Push it first"* ]]' "$out"
out="$(STUB_GIT_ORIGIN=git@github.com:o/idp.git run $DEPLOY resolve_gitops_source)"
check 'refuses a non-https repository URL' '[[ $? -ne 0 && "$out" == *"must be an https URL"* ]]' "$out"
out="$(STUB_GIT_HEAD=local-only GITOPS_BRANCH=main run $DEPLOY 'resolve_gitops_source && echo ok')"
check 'tracks another pushed branch without comparing it to the checkout' '[[ "$out" == *ok ]]' "$out"

# --- deploy: Flux settings and configuration ---------------------------------
reset_logs
settings='AZURE_TENANT_ID=t1 AZURE_SUBSCRIPTION_ID=s1 LOCATION=westus3 CROSSPLANE_CLIENT_ID=xp1 IDP_WEB_CLIENT_ID=web1 IMAGE_REF=acr1.azurecr.io/idp-web:1 WORKLOAD_ARCH=amd64 INGRESS_HOST=h.example; write_platform_settings'
run $DEPLOY "$settings" >/dev/null
# shellcheck disable=SC2034 # read inside check's eval
created="$(grep "create configmap idp-platform-settings" "$WORK_DIR/kubectl.log")"
check 'writes the settings Flux substitutes, in the Flux configuration namespace' \
  '[[ "$created" == "-n cluster-config create configmap idp-platform-settings "* && "$created" == *"--from-literal=IMAGE_REF=acr1.azurecr.io/idp-web:1 "* && "$created" == *"--from-literal=INGRESS_HOST=h.example "* && "$created" != *DNS_LABEL* && "$created" != *ACME_SERVER* ]]' \
  "$(cat "$WORK_DIR/kubectl.log")"
check 'labels the settings so Flux re-applies when they change' \
  'grep -q "label --local -f - reconcile.fluxcd.io/watch=Enabled" "$WORK_DIR/kubectl.log"' "$(cat "$WORK_DIR/kubectl.log")"

flux_cfg='RESOURCE_GROUP=rg AKS_CLUSTER_NAME=c GITOPS_REPO_URL=https://github.com/o/idp.git GITOPS_BRANCH=feature; ensure_flux_configuration'
reset_logs
STUB_FLUX_CONFIG=no run $DEPLOY "$flux_cfg" >/dev/null
create="$(grep "^k8s-configuration flux create" "$WORK_DIR/az.log")"
check 'creates a cluster-scoped Flux configuration on the platform path' \
  '[[ "$create" == *"--cluster-type managedClusters"* && "$create" == *"--name idp-platform"* && "$create" == *"--namespace cluster-config"* && "$create" == *"--scope cluster"* && "$create" == *"--url https://github.com/o/idp.git"* && "$create" == *"--branch feature"* && "$create" == *"--kustomization name=platform path=./platform/gitops/clusters/idp-aks-auto prune=true"* ]]' \
  "$(cat "$WORK_DIR/az.log")"
reset_logs
run $DEPLOY "$flux_cfg" >/dev/null
check 'updates the source of an existing Flux configuration instead of recreating it' \
  'grep -q "^k8s-configuration flux update .*--name idp-platform .*--url https://github.com/o/idp.git --branch feature" "$WORK_DIR/az.log" && ! grep -q "flux create" "$WORK_DIR/az.log"' \
  "$(cat "$WORK_DIR/az.log")"

reset_logs
out="$(STUB_DEPLOYED_IMAGE=acr1.azurecr.io/idp-web:2 run $DEPLOY 'IMAGE_REF=acr1.azurecr.io/idp-web:2; wait_for_platform && echo platform-ready')"
check 'waits for every Flux Kustomization and the new image rollout' \
  '[[ "$out" == *platform-ready ]] && [[ "$(grep -o "wait --for=condition=Ready kustomization/[a-z-]*" "$WORK_DIR/kubectl.log" | sed "s|.*/||" | tr "\n" " ")" == "crossplane crossplane-providers crossplane-configs idp " ]] && grep -q "rollout status deployment/idp-web" "$WORK_DIR/kubectl.log"' \
  "$out$(cat "$WORK_DIR/kubectl.log")"
out="$(STUB_DEPLOYED_IMAGE=acr1.azurecr.io/idp-web:1 run $DEPLOY 'IMAGE_REF=acr1.azurecr.io/idp-web:2; wait_for_platform')"
check 'fails when Flux never rolls out the new image' '[[ $? -ne 0 && "$out" == *"still runs acr1.azurecr.io/idp-web:1"* ]]' "$out"

out="$(run $DEPLOY 'declare -f main')"
order="$(grep -oE "create_app_env_secret|write_platform_settings|ensure_flux_configuration|wait_for_platform|build_and_push_image|resolve_gitops_source|ensure_cluster_context" <<<"$out" | tr '\n' ' ')"
check 'checks the Git source first, then hands the cluster to Flux once its inputs exist' \
  '[[ "$order" == "resolve_gitops_source ensure_cluster_context build_and_push_image create_app_env_secret write_platform_settings ensure_flux_configuration wait_for_platform " ]]' "$order"

# --- deploy: public endpoint -------------------------------------------------
endpoint='RESOURCE_GROUP=rg AKS_CLUSTER_NAME=c; resolve_public_endpoint; echo "host=$INGRESS_HOST url=$NEXTAUTH_EXTERNAL_URL"'
reset_logs
out="$(run $DEPLOY "$endpoint")"
check 'serves the portal one label below the cluster default domain' \
  '[[ "$out" == *"host=idp.0123456789abcdef01234567.westus3.aksapp.io url=https://idp.0123456789abcdef01234567.westus3.aksapp.io" ]] && grep -q "aks approuting defaultdomain show --resource-group rg --name c --query domainName" "$WORK_DIR/az.log"' \
  "$out$(cat "$WORK_DIR/az.log")"
out="$(INGRESS_HOST=idp.example.com run $DEPLOY "$endpoint")"
check 'ignores an INGRESS_HOST the managed certificate cannot cover' '[[ "$out" == *"host=idp.0123456789abcdef01234567.westus3.aksapp.io "* ]]' "$out"
out="$(STUB_DOMAIN='' run $DEPLOY "$endpoint")"
check 'fails when AKS never assigns a default domain' '[[ $? -ne 0 && "$out" == *"assigned no default domain"* ]]' "$out"

# --- deploy: Gateway add-ons -------------------------------------------------
reset_logs
STUB_ADDON_STATE='Standard Enabled true true' run $DEPLOY 'RESOURCE_GROUP=rg AKS_CLUSTER_NAME=c; ensure_gateway_addons' >/dev/null
check 'leaves Gateway add-ons and the default domain alone when already enabled' \
  '! grep -q -e "aks update" -e "aks approuting" "$WORK_DIR/az.log"' "$(cat "$WORK_DIR/az.log")"
reset_logs
STUB_ADDON_STATE='null null null null' run $DEPLOY 'RESOURCE_GROUP=rg AKS_CLUSTER_NAME=c; ensure_gateway_addons' >/dev/null
check 'enables the managed Gateway API and app routing Istio when missing' \
  'grep -q "aks update.*--enable-gateway-api --enable-app-routing-istio" "$WORK_DIR/az.log"' "$(cat "$WORK_DIR/az.log")"
check 'turns on the app routing add-on with the default domain and no NGINX' \
  'grep -q "^aks approuting enable --resource-group rg --name c --enable-default-domain --nginx None" "$WORK_DIR/az.log" && ! grep -q "approuting update" "$WORK_DIR/az.log"' "$(cat "$WORK_DIR/az.log")"
check 'never enables the Key Vault CSI add-on' '! grep -q -e "enable-addons" -e "enable-kv" "$WORK_DIR/az.log"' "$(cat "$WORK_DIR/az.log")"
reset_logs
STUB_ADDON_STATE='Standard Enabled true false' run $DEPLOY 'RESOURCE_GROUP=rg AKS_CLUSTER_NAME=c; ensure_gateway_addons' >/dev/null
check 'adds the default domain to an existing app routing add-on' \
  'grep -q "^aks approuting update --resource-group rg --name c --enable-default-domain" "$WORK_DIR/az.log" && ! grep -q -e "approuting enable" -e "aks update" "$WORK_DIR/az.log"' "$(cat "$WORK_DIR/az.log")"
out="$(run $DEPLOY 'declare -f main')"
order="$(grep -oE "ensure_gateway_addons|resolve_public_endpoint|ensure_redirect_uri" <<<"$out" | tr '\n' ' ')"
check 'reads the domain only after enabling it, and before registering the redirect URI' \
  '[[ "$order" == "ensure_gateway_addons resolve_public_endpoint ensure_redirect_uri " ]]' "$order"

# --- deploy: redirect URI ----------------------------------------------------
reset_logs
run $DEPLOY 'PORTAL_APP_ID=app1 NEXTAUTH_EXTERNAL_URL=https://idp.example.com; ensure_redirect_uri' >/dev/null
STUB_REDIRECT_URIS=$'https://old.example/cb\nhttps://idp.example.com/api/auth/callback/azure-ad' \
  run $DEPLOY 'PORTAL_APP_ID=app1 NEXTAUTH_EXTERNAL_URL=https://idp.example.com; ensure_redirect_uri' >/dev/null
check 'adds the callback once and is a no-op when it is registered' \
  '[[ "$(grep -c "ad app update" "$WORK_DIR/az.log")" == 1 ]] && grep -q -- "--web-redirect-uris https://idp.example.com/api/auth/callback/azure-ad" "$WORK_DIR/az.log"' \
  "$(cat "$WORK_DIR/az.log")"
reset_logs
STUB_REDIRECT_URIS='https://old.example/cb' \
  run $DEPLOY 'PORTAL_APP_ID=app1 NEXTAUTH_EXTERNAL_URL=https://idp.example.com; ensure_redirect_uri' >/dev/null
check 'keeps existing redirect URIs when adding the callback' \
  'grep -q -- "--web-redirect-uris https://old.example/cb https://idp.example.com/api/auth/callback/azure-ad" "$WORK_DIR/az.log"' \
  "$(cat "$WORK_DIR/az.log")"

# --- deploy: app secret ------------------------------------------------------
reset_logs
snippet='PLATFORM_KEYVAULT_NAME=kv1 PORTAL_APP_ID=app1 AZURE_TENANT_ID=tenant1 AZURE_SUBSCRIPTION_ID=sub1 NEXTAUTH_EXTERNAL_URL=https://idp.example.com DESIRED_STATE_BLOB_URL=https://st.blob.core.windows.net/ DESIRED_STATE_CONTAINER=desired-state; create_app_env_secret'
out="$(run $DEPLOY "$snippet")"
# shellcheck disable=SC2034 # read inside check's eval
expected=$'NEXTAUTH_URL=https://idp.example.com\nNEXTAUTH_SECRET=nextauth-value\nAZURE_AD_CLIENT_ID=app1\nAZURE_AD_CLIENT_SECRET=portal-value\nAZURE_AD_TENANT_ID=tenant1\nAZURE_SUBSCRIPTION_ID=sub1\nIDP_DESIRED_STATE_AZURE_BLOB_ACCOUNT_URL=https://st.blob.core.windows.net/\nIDP_DESIRED_STATE_AZURE_BLOB_CONTAINER=desired-state'
check 'builds the app secret from Key Vault with exactly the expected keys' \
  '[[ "$(cat "$WORK_DIR/secret.env" 2>/dev/null)" == "$expected" ]]' "$out$(cat "$WORK_DIR/secret.env" 2>/dev/null)"
check 'never logs secret values' '[[ "$out" != *nextauth-value* && "$out" != *portal-value* ]]' "$out"
reset_logs
out="$(STUB_PORTAL_SECRET='' run $DEPLOY "$snippet")"
check 'fails when a Key Vault secret is missing' \
  '[[ $? -ne 0 && "$out" == *"missing nextauth-secret or portal-client-secret"* && ! -e "$WORK_DIR/secret.env" ]]' "$out"

# --- deploy: ACR name --------------------------------------------------------
out="$(AKS_CLUSTER_NAME=idp-aks-auto run $DEPLOY 'echo "acr=$(generate_acr_name)"')"
check 'generates an ACR name under set -euo pipefail' '[[ "$out" =~ acr=idpaksauto[0-9a-f]{6}$ ]]' "$out"

# --- common: az auto-upgrade prompt ------------------------------------------
mkdir -p "$WORK_DIR/azcfg"
printf '[auto-upgrade]\nenable = yes\n' > "$WORK_DIR/azcfg/config"
out="$(run $DEPLOY require_no_az_upgrade_prompt)"
check 'stops when az auto-upgrade would prompt' '[[ $? -ne 0 && "$out" == *"auto-upgrade.enable=no"* ]]' "$out"
printf '[auto-upgrade]\nenable = no\n' > "$WORK_DIR/azcfg/config"
out="$(run $DEPLOY 'require_no_az_upgrade_prompt && echo clear')"
check 'continues when auto-upgrade is off' '[[ "$out" == *clear ]]' "$out"

# --- common: kubectl apply retry ---------------------------------------------
reset_logs
echo 2 > "$WORK_DIR/apply-fails"
out="$(STUB_APPLY_ERROR='Error from server (InternalError): Post "https://guard.x/subjectaccessreviews?timeout=3s": net/http: request canceled (Client.Timeout exceeded while awaiting headers)' \
  run $DEPLOY 'echo "kind: Namespace" | kubectl_apply && echo applied')"
check 'retries an apply that hits the authorization webhook timeout' \
  '[[ "$out" == *applied && "$(cat "$WORK_DIR/apply-fails")" == 0 && "$out" == *"attempt 2/5"* ]]' "$out"
check 'the retried apply still sends the manifest' \
  '[[ "$(cat "$WORK_DIR/applied.yaml" 2>/dev/null)" == $'"'"'kind: Namespace\n---'"'"' ]]' "$(cat "$WORK_DIR/applied.yaml" 2>/dev/null)"
echo 2 > "$WORK_DIR/apply-fails"
out="$(STUB_APPLY_ERROR='error: error validating "STDIN": unknown field "spec.bogus"' run $DEPLOY 'echo "kind: Namespace" | kubectl_apply')"
check 'fails at once on a non-transient apply error' \
  '[[ $? -ne 0 && "$(cat "$WORK_DIR/apply-fails")" == 1 && "$out" == *bogus* ]]' "$out"
rm -f "$WORK_DIR/apply-fails"

# --- bootstrap: desired-state storage ----------------------------------------
reset_logs
out="$(run $BOOTSTRAP 'RESOURCE_GROUP=rg LOCATION=westus3; ensure_desired_state_storage; echo "name=$DESIRED_STATE_STORAGE_ACCOUNT"')"
check 'generates a desired-state account name and disables shared keys' \
  '[[ "$out" =~ name=idpstate[0-9a-f]{12}$ ]] && grep -q -- "--allow-shared-key-access false" "$WORK_DIR/az.log"' "$out"

# --- bootstrap: node pool size ---------------------------------------------
out="$(STUB_VCPUS=2 run $BOOTSTRAP 'ARM64_VM_SIZE=Standard_D2pds_v5 LOCATION=westus3; ensure_supported_vm_size')"
check 'rejects node sizes under 4 vCPUs (AKS Automatic LocalDNS)' '[[ $? -ne 0 && "$out" == *"needs at least 4"* ]]' "$out"
out="$(run $BOOTSTRAP 'ARM64_VM_SIZE=Standard_Nope LOCATION=westus3; ensure_supported_vm_size')"
check 'rejects a size not offered in the region' '[[ $? -ne 0 && "$out" == *"not available"* ]]' "$out"
out="$(STUB_VCPUS=4 run $BOOTSTRAP 'LOCATION=westus3; ensure_supported_vm_size && echo "size=$ARM64_VM_SIZE"')"
check 'accepts the default 4-vCPU size' '[[ "$out" == *"size=Standard_D4pds_v5" ]]' "$out"

# --- bootstrap: Kubernetes version -----------------------------------------
out="$(STUB_VERSIONS=$'1.34\n1.37\n1.36\n1.35' run $BOOTSTRAP 'LOCATION=westus3; ensure_target_kubernetes_version; echo "k8s=$KUBERNETES_VERSION"')"
check 'new clusters use the newest GA minor version in the region' '[[ "$out" == *k8s=1.37 ]]' "$out"
out="$(STUB_EXISTING_VERSION=1.36.4 STUB_VERSIONS=1.37 run $BOOTSTRAP 'ensure_target_kubernetes_version; echo "k8s=$KUBERNETES_VERSION"')"
check 'reruns keep the existing cluster version' '[[ "$out" == *k8s=1.36.4 ]]' "$out"
out="$(STUB_EXISTING_VERSION=1.34.11 KUBERNETES_VERSION=1.37 run $BOOTSTRAP 'ensure_target_kubernetes_version')"
check 'fails when an explicit version does not match the existing cluster' '[[ $? -ne 0 && "$out" == *"not the requested 1.37"* ]]' "$out"

# --- bootstrap: federated credentials ---------------------------------------
fic='RESOURCE_GROUP=rg AKS_CLUSTER_NAME=c LOCATION=westus3; ensure_federated_identity id1 idp-system idp-web'
reset_logs
STUB_FIC='https://issuer.old/ system:serviceaccount:idp-system:idp-web' run $BOOTSTRAP "$fic" >/dev/null
check 'repoints a federated credential at a recreated cluster issuer' \
  'grep -q "federated-credential update .*--issuer https://issuer.new/ --subject system:serviceaccount:idp-system:idp-web" "$WORK_DIR/az.log" && ! grep -q "federated-credential create" "$WORK_DIR/az.log"' \
  "$(cat "$WORK_DIR/az.log")"
reset_logs
STUB_FIC='https://issuer.new/ system:serviceaccount:idp-system:idp-web' run $BOOTSTRAP "$fic" >/dev/null
check 'leaves a current federated credential alone' \
  '! grep -q -e "federated-credential update" -e "federated-credential create" "$WORK_DIR/az.log"' "$(cat "$WORK_DIR/az.log")"
reset_logs
run $BOOTSTRAP "$fic" >/dev/null
check 'creates a missing federated credential' \
  'grep -q "federated-credential create .*--issuer https://issuer.new/ --subject system:serviceaccount:idp-system:idp-web" "$WORK_DIR/az.log"' \
  "$(cat "$WORK_DIR/az.log")"

# --- bootstrap: Arm64 Spot pool --------------------------------------------
pool='RESOURCE_GROUP=rg AKS_CLUSTER_NAME=c ARM64_POOL_NAME=spotarm64 ARM64_VM_SIZE=Standard_D4pds_v5 LOCATION=westus3; ensure_spot_pool && echo "pool-step-ok"'
reset_logs
out="$(STUB_POOL_STATE=Failed run $BOOTSTRAP "$pool")"
check 'deletes a Failed pool before adding it again' \
  '[[ "$out" == *pool-step-ok ]] && [[ "$(grep -n -e "nodepool delete" -e "nodepool add" "$WORK_DIR/az.log" | cut -d" " -f3 | tr "\n" " ")" == "delete add " ]]' \
  "$out$(cat "$WORK_DIR/az.log")"
reset_logs
out="$(STUB_ADD_STATUS=1 STUB_ADD_OUTPUT='ERROR: (SkuNotAvailable) The requested VM size ... is currently not available' run $BOOTSTRAP "$pool")"
check 'continues without the pool when Spot capacity is unavailable' \
  '[[ "$out" == *pool-step-ok && "$out" == *"no Spot capacity"* ]] && grep -q "nodepool delete" "$WORK_DIR/az.log"' \
  "$out$(cat "$WORK_DIR/az.log")"
reset_logs
out="$(STUB_ADD_STATUS=1 STUB_ADD_OUTPUT='ERROR: (QuotaExceeded) Operation could not be completed as it results in exceeding approved quota' run $BOOTSTRAP "$pool")"
check 'still fails on non-capacity errors such as quota' \
  '[[ "$out" != *pool-step-ok && "$out" == *QuotaExceeded* ]] && ! grep -q "nodepool delete" "$WORK_DIR/az.log"' \
  "$out$(cat "$WORK_DIR/az.log")"
reset_logs
out="$(STUB_POOL_STATE=Succeeded run $BOOTSTRAP "$pool")"
check 'leaves a healthy pool alone' \
  '[[ "$out" == *pool-step-ok ]] && ! grep -q -e "nodepool add" -e "nodepool delete" "$WORK_DIR/az.log"' \
  "$out$(cat "$WORK_DIR/az.log")"

# --- bootstrap: compliance framework -----------------------------------------
reset_logs
out="$(STUB_POLICY_ASSIGNED=no run $BOOTSTRAP 'SUBSCRIPTION_ID=sub1 LOCATION=westus3; ensure_compliance_assignment')"
create="$(grep '^policy assignment create' "$WORK_DIR/az.log")"
check 'assigns MCSB v2 audit-only at subscription scope' \
  '[[ "$create" == *"--policy-set-definition e3ec7e09-768c-4b64-882c-fcada3772047"* && "$create" == *"--scope /subscriptions/sub1"* && "$create" == *"--enforcement-mode DoNotEnforce"* && "$create" == *"--name idp-mcsb-v2"* ]]' "$out$create"
check 'gives the assignment identity no role' \
  '[[ "$create" != *"--role"* && "$create" != *"--identity-scope"* ]]' "$create"
check 'starts the first compliance scan' 'grep -q "^policy state trigger-scan" "$WORK_DIR/az.log"' "$(cat "$WORK_DIR/az.log")"
check 'app and bootstrap use the same assignment name' \
  'grep -q "COMPLIANCE_ASSIGNMENT_NAME = '"'"'idp-mcsb-v2'"'"'" "$AZURE_DIR/../../src/lib/catalog/livePortfolio.ts"' "check src/lib/catalog/livePortfolio.ts"
reset_logs
run $BOOTSTRAP 'SUBSCRIPTION_ID=sub1; ensure_compliance_assignment' >/dev/null
check 'leaves an existing assignment alone' '! grep -q "^policy assignment create" "$WORK_DIR/az.log"' "$(cat "$WORK_DIR/az.log")"
out="$(run $BOOTSTRAP 'declare -f main')"
check 'bootstrap runs the compliance assignment' '[[ "$out" == *ensure_compliance_assignment* ]]' "$out"
check 'bootstrap no longer creates a Gateway TLS identity' '[[ "$out" != *gateway_tls* ]]' "$out"

# --- bootstrap: GitOps prerequisites -----------------------------------------
reset_logs
run $BOOTSTRAP 'register_prereqs' >/dev/null
check 'registers the resource provider behind the Flux extension' \
  'grep -q "provider register --namespace Microsoft.KubernetesConfiguration" "$WORK_DIR/az.log"' "$(cat "$WORK_DIR/az.log")"
check 'registers and waits for the hosted system and default domain preview features' \
  '[[ "$(grep -oE "^feature (register|show) --name [A-Za-z-]+" "$WORK_DIR/az.log" | sort | tr "\n" ",")" == "feature register --name AKS-AutomaticHostedSystemProfilePreview,feature register --name DefaultDomainPreview,feature show --name AKS-AutomaticHostedSystemProfilePreview,feature show --name DefaultDomainPreview," ]]' "$(cat "$WORK_DIR/az.log")"

# --- bootstrap: Key Vault secrets --------------------------------------------
reset_logs
out="$(run $BOOTSTRAP 'PLATFORM_KEYVAULT_NAME=kv1; printf "" | store_keyvault_secret empty-one')"
check 'refuses to store an empty secret' \
  '[[ $? -ne 0 && "$out" == *"empty value"* && ! -e "$WORK_DIR/kv-writes" ]]' "$out"

reset_logs
out="$(run $BOOTSTRAP 'PLATFORM_KEYVAULT_NAME=kv1 AKS_CLUSTER_NAME=c PORTAL_APP_NAME=c-portal; ensure_portal_app; echo "app=$PORTAL_APP_ID"')"
check 'creates the app, requires assignment, and assigns the operator' \
  '[[ "$out" == *app=new-app-id ]] && grep -q "ad app create --display-name c-portal --sign-in-audience AzureADMyOrg" "$WORK_DIR/az.log" && grep -q "appRoleAssignmentRequired=true" "$WORK_DIR/az.log" && grep -q "rest --method POST.*appRoleAssignedTo.*user-oid" "$WORK_DIR/az.log"' \
  "$out$(cat "$WORK_DIR/az.log")"
check 'stores the client secret and NEXTAUTH_SECRET in Key Vault' \
  'grep -qx "portal-client-secret=s3cret-from-entra" "$WORK_DIR/kv-writes" && grep -Eq "^nextauth-secret=.{40,}$" "$WORK_DIR/kv-writes"' \
  "$(cat "$WORK_DIR/kv-writes" 2>/dev/null)"
check 'never puts a secret on an az command line' \
  '! grep -q -e "s3cret-from-entra" -e "--value" "$WORK_DIR/az.log"' "$(cat "$WORK_DIR/az.log")"
check 'appends a credential instead of replacing existing ones' \
  'grep -q "ad app credential reset --id new-app-id --append" "$WORK_DIR/az.log"' "$(cat "$WORK_DIR/az.log")"

reset_logs
out="$(STUB_APP_IDS=existing-app STUB_SP_ID=sp-oid STUB_ASSIGNED=1 STUB_SECRETS_EXIST=yes \
  run $BOOTSTRAP 'PLATFORM_KEYVAULT_NAME=kv1 AKS_CLUSTER_NAME=c PORTAL_APP_NAME=c-portal; ensure_portal_app; echo "app=$PORTAL_APP_ID"')"
check 'reruns reuse the app and issue no new credentials' \
  '[[ "$out" == *app=existing-app ]] && ! grep -q -e "ad app create" -e "credential reset" -e "rest --method POST" "$WORK_DIR/az.log" && [[ ! -e "$WORK_DIR/kv-writes" ]]' \
  "$out$(cat "$WORK_DIR/az.log")"

reset_logs
out="$(STUB_APP_IDS=$'a1\na2' run $BOOTSTRAP 'PORTAL_APP_NAME=dup; ensure_portal_app')"
check 'fails on an ambiguous app registration name' '[[ $? -ne 0 && "$out" == *"More than one"* ]]' "$out"

reset_logs
out="$(STUB_CLIENT_SECRET='' run $BOOTSTRAP 'PLATFORM_KEYVAULT_NAME=kv1 AKS_CLUSTER_NAME=c PORTAL_APP_NAME=c-portal; ensure_portal_app')"
check 'fails instead of storing an empty client secret' \
  '[[ $? -ne 0 ]] && ! grep -q "^portal-client-secret=" "$WORK_DIR/kv-writes" 2>/dev/null' "$out"

# --- teardown ----------------------------------------------------------------
TEARDOWN=teardown-aks-platform.sh
WS=/subscriptions/sub1/resourceGroups/DefaultResourceGroup-westus3/providers/microsoft.monitor/accounts/DefaultAzureMonitorWorkspace-westus3
down='RESOURCE_GROUP=rg AKS_CLUSTER_NAME=c LOCATION=westus3 PORTAL_APP_NAME=c-portal ASSUME_YES=true; main && echo down-ok'
# step <pattern>: line number of the first call matching pattern (0 if none).
step() { grep -n -m1 -E -- "$1" "$WORK_DIR/calls.log" | cut -d: -f1 || true; }

reset_logs
out="$(printf 'wrong\n' | run $TEARDOWN 'RESOURCE_GROUP=rg; main')"
# shellcheck disable=SC2034 # read inside check's eval
rc=$?
check 'refuses to delete anything without the typed confirmation' \
  '[[ $rc -ne 0 && "$out" == *"Not confirmed"* ]] && ! grep -q -E "delete|purge|patch" "$WORK_DIR/calls.log"' "$out$(cat "$WORK_DIR/calls.log")"
reset_logs
out="$(printf 'rg\n' | run $TEARDOWN 'RESOURCE_GROUP=rg AKS_CLUSTER_NAME=c PORTAL_APP_NAME=c-portal; main && echo down-ok')"
check 'proceeds when the resource group name is typed' '[[ "$out" == *down-ok ]]' "$out"

reset_logs
out="$(STUB_APP_IDS=app1 STUB_KEYVAULT=kv1 run $TEARDOWN "$down")"
order=""
for pattern in "^kubectl -n cluster-config patch .*suspend" "^kubectl delete managed --all --all-namespaces" "^az role assignment delete --ids /ra/1 /ra/2" \
  "^az policy assignment delete --name idp-mcsb-v2" "^az ad app delete --id app1" "deletedItems/app-object-id" "^az group delete --name rg --yes" \
  "^az keyvault purge --name kv1" "^az resource delete --ids $WS" "^az group delete --name DefaultResourceGroup-westus3" "^kubectl config delete-context c"; do
  order+="$(step "$pattern") "
done
# shellcheck disable=SC2034 # read inside check's eval
sorted="$(tr ' ' '\n' <<<"$order" | grep . | sort -n | tr '\n' ' ')"
check 'tears down in a safe order: Flux suspended, managed resources, role assignments, then the group, vault purge, workspace' \
  '[[ "$out" == *down-ok && "$order" != *"  "* && "$order" != " "* && "$order" == "$sorted" ]]' "order: $order"$'"'"'\n'"'"'"$(cat "$WORK_DIR/calls.log")"
check 'removes role assignments at every scope, not just inside the resource group' \
  'grep -q "^role assignment list --all --assignee-object-id principal-oid" "$WORK_DIR/az.log"' "$(cat "$WORK_DIR/az.log")"

reset_logs
out="$(STUB_REMAINING_MANAGED='account.storage.azure.m.upbound.io/team-a/sa1' run $TEARDOWN "$down")"
check 'stops before deleting the cluster while Crossplane still holds Azure resources' \
  '[[ "$out" != *down-ok && "$out" == *team-a/sa1* && "$out" == *SKIP_MANAGED_RESOURCE_CLEANUP* ]] && ! grep -q -e "group delete" -e "role assignment delete" "$WORK_DIR/az.log"' "$out"
reset_logs
out="$(STUB_REMAINING_MANAGED='account.storage.azure.m.upbound.io/team-a/sa1' SKIP_MANAGED_RESOURCE_CLEANUP=true run $TEARDOWN "$down")"
check 'SKIP_MANAGED_RESOURCE_CLEANUP leaves Crossplane alone and continues' \
  '[[ "$out" == *down-ok ]] && ! grep -q "delete managed" "$WORK_DIR/kubectl.log" && grep -q "group delete --name rg" "$WORK_DIR/az.log"' "$out"

reset_logs
out="$(STUB_ALL_DCRS=/other/dcr run $TEARDOWN "$down")"
check 'keeps the default Monitor workspace while another data collection rule uses it' \
  '[[ "$out" == *down-ok && "$out" == *"still used by /other/dcr"* ]] && ! grep -q "resource delete" "$WORK_DIR/az.log"' "$out"
reset_logs
out="$(STUB_WORKSPACE=/subscriptions/sub1/resourceGroups/rg-mon/providers/microsoft.monitor/accounts/team-workspace run $TEARDOWN "$down")"
check 'never deletes a Monitor workspace it did not get from AKS defaults' '! grep -q "resource delete" "$WORK_DIR/az.log"' "$(cat "$WORK_DIR/az.log")"
reset_logs
STUB_GROUP_RESOURCES=3 run $TEARDOWN "$down" >/dev/null
check 'keeps the default resource group when other resources are in it' \
  'grep -q "resource delete" "$WORK_DIR/az.log" && ! grep -q "group delete --name DefaultResourceGroup" "$WORK_DIR/az.log"' "$(cat "$WORK_DIR/az.log")"

reset_logs
out="$(STUB_KEYVAULT=kv1 STUB_PURGE_PROTECTION=true run $TEARDOWN "$down")"
check 'does not try to purge a vault with purge protection' '[[ "$out" == *"cannot be purged"* ]] && ! grep -q "keyvault purge" "$WORK_DIR/az.log"' "$out"

reset_logs
out="$(STUB_CLUSTER=no STUB_GROUP_EXISTS=false STUB_ROLE_IDS='' STUB_POLICY_ASSIGNED=no STUB_APP_IDS='' run $TEARDOWN "$down")"
check 'a rerun after a full teardown deletes nothing and succeeds' \
  '[[ "$out" == *down-ok ]] && ! grep -q -E "^az .*(delete|purge)|^kubectl (delete managed|.*patch)" "$WORK_DIR/calls.log"' "$out$(cat "$WORK_DIR/calls.log")"
check 'npm run azure:down runs the teardown script' \
  'grep -q "\"azure:down\": \"bash scripts/azure/teardown-aks-platform.sh\"" "$AZURE_DIR/../../package.json"' ""

# --- hygiene -----------------------------------------------------------------
check 'no temp files with secrets left behind' '[[ -z "$(ls -A "$WORK_DIR/tmp")" ]]' "$(ls -la "$WORK_DIR/tmp")"

exit "$failures"

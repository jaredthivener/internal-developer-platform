#!/usr/bin/env bash
# Renders every Flux Kustomization in platform/gitops offline (flux build
# --dry-run, with the deploy script's settings substituted from sample values)
# and checks the result. Needs the flux CLI and yq v4.
# Run: bash scripts/azure/gitops.test.sh

set -uo pipefail

AZURE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$AZURE_DIR/../.." && pwd)"
DEPLOY="$AZURE_DIR/deploy-platform-to-aks.sh"
CLUSTER_DIR="$ROOT_DIR/platform/gitops/clusters/idp-aks-auto"
FLUX_OBJECTS="$CLUSTER_DIR/platform.yaml"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT
failures=0

for tool in flux yq; do
  command -v "$tool" >/dev/null || { echo "FAIL: $tool is required"; exit 1; }
done

check() { # description, condition (evaluated), [context to print on failure]
  if eval "$2"; then
    printf 'ok:   %s\n' "$1"
  else
    printf 'FAIL: %s\n%s\n' "$1" "${3:-}"
    failures=$((failures + 1))
  fi
}

# Sample values for every key the deploy script writes to the settings ConfigMap.
declare -A sample=(
  [AZURE_TENANT_ID]=tenant-1
  [AZURE_SUBSCRIPTION_ID]=sub-1
  [LOCATION]=westus3
  [CROSSPLANE_CLIENT_ID]=crossplane-client-1
  [IDP_WEB_CLIENT_ID]=web-client-1
  [IMAGE_REF]=acr1.azurecr.io/idp-web:20260101000000
  [WORKLOAD_ARCH]=amd64
  [INGRESS_HOST]=idp.0123456789abcdef01234567.westus3.aksapp.io
)

# Keys the deploy script actually writes (--from-literal=KEY=...).
script_keys="$(grep -oE -- '--from-literal=[A-Z_]+=' "$DEPLOY" | sed -E 's/--from-literal=([A-Z_]+)=/\1/' | sort -u)"
check 'the test covers exactly the settings the deploy script writes' \
  '[[ "$script_keys" == "$(printf "%s\n" "${!sample[@]}" | sort)" ]]' "script writes: $script_keys"

names="$(yq -N 'select(.kind == "Kustomization") | .metadata.name' "$FLUX_OBJECTS")"
check 'declares the platform Kustomizations' \
  '[[ "$(sort <<<"$names" | tr "\n" " ")" == "crossplane crossplane-configs crossplane-providers idp " ]]' "$names"

SUBST_FILE="$WORK_DIR/substitute.yaml"
echo '{}' > "$SUBST_FILE"
for key in "${!sample[@]}"; do
  K="$key" V="${sample[$key]}" yq -i '.[strenv(K)] = strenv(V)' "$SUBST_FILE"
done
export SUBST_FILE

# build <name>: renders one Flux Kustomization with the sample settings inline
# in place of the ConfigMap (dry-run mode cannot read ConfigMaps).
build() {
  local name="$1" file="$WORK_DIR/$1.ks.yaml" path
  NAME="$name" yq 'select(.kind == "Kustomization" and .metadata.name == strenv(NAME))
    | with(select(.spec.postBuild.substituteFrom); .spec.postBuild.substitute = load(strenv(SUBST_FILE)) | del(.spec.postBuild.substituteFrom))' \
    "$FLUX_OBJECTS" > "$file"
  path="$(yq '.spec.path' "$file")"
  flux build kustomization "$name" --namespace cluster-config --path "$ROOT_DIR/$path" --kustomization-file "$file" --dry-run 2>&1
}

declare -A out
for name in $names; do
  out[$name]="$(build "$name")"
  check "$name builds" '[[ $? -eq 0 && -n "${out[$name]}" ]]' "${out[$name]}"
  check "$name leaves no unsubstituted variables" '! grep -q "\${" <<<"${out[$name]}"' "$(grep -n '\${' <<<"${out[$name]}")"
done

# Every variable a substituting Kustomization's files use must be a key the
# script writes; Flux silently turns an unknown \${VAR} into an empty string.
for name in $names; do
  path="$(NAME="$name" yq 'select(.kind == "Kustomization" and .metadata.name == strenv(NAME)) | .spec.path' "$FLUX_OBJECTS")"
  used="$(grep -rhoE '\$\{[A-Za-z_][A-Za-z0-9_]*' "$ROOT_DIR/$path" | sed 's/^\${//' | sort -u)"
  substitutes="$(NAME="$name" yq 'select(.kind == "Kustomization" and .metadata.name == strenv(NAME)) | .spec.postBuild.substituteFrom[0].name // ""' "$FLUX_OBJECTS")"
  unknown="$(comm -23 <(printf '%s\n' "$used" | grep .) <(printf '%s\n' "$script_keys"))"
  check "$name uses only variables the script writes" \
    '[[ -z "$used" || ( "$substitutes" == idp-platform-settings && -z "$unknown" ) ]]' "used: $used / unknown: $unknown / substituteFrom: $substitutes"
done

# --- multi-tenancy: the extension only lets Flux objects use sources in the
# Flux configuration's own namespace, and impersonates flux-applier there. -----
flux_objects="$(cat "$FLUX_OBJECTS"; echo ---; for name in $names; do printf '%s\n---\n' "${out[$name]}"; done)"
bad_ns="$(yq -N 'select(.apiVersion == "*toolkit.fluxcd.io*" and .metadata.namespace != "cluster-config") | .kind + "/" + .metadata.name' <<<"$flux_objects")"
flux_count="$(yq -N 'select(.apiVersion == "*toolkit.fluxcd.io*") | .kind' <<<"$flux_objects" | grep -c .)"
check 'every Flux object lives in cluster-config' '[[ "$flux_count" -ge 6 && -z "$bad_ns" ]]' "$flux_count objects; outside cluster-config: $bad_ns"
bad_refs="$(yq -N 'select(.apiVersion == "*toolkit.fluxcd.io*") | [.spec.sourceRef, .spec.chartRef, .spec.chart.spec.sourceRef] | .[] | select(. != null and .namespace != null and .namespace != "cluster-config") | .name' <<<"$flux_objects")"
check 'no Flux object references a source in another namespace' '[[ -z "$bad_refs" ]]' "$bad_refs"
config_name="$(sed -nE 's/^FLUX_CONFIG_NAME="\$\{FLUX_CONFIG_NAME:-(.*)\}"$/\1/p' "$DEPLOY")"
sources="$(yq -N 'select(.kind == "Kustomization") | .spec.sourceRef.kind + "/" + .spec.sourceRef.name' "$FLUX_OBJECTS" | sort -u)"
check 'Kustomizations use the GitRepository the Flux configuration creates' \
  '[[ -n "$config_name" && "$sources" == "GitRepository/$config_name" ]]' "config: $config_name sources: $sources"
check 'the deploy script points the Flux configuration at this directory' \
  'grep -q "path=./platform/gitops/clusters/idp-aks-auto" "$DEPLOY"' ""

dep() { NAME="$1" yq -N 'select(.kind == "Kustomization" and .metadata.name == strenv(NAME)) | .spec.dependsOn[].name' "$FLUX_OBJECTS" | tr '\n' ' '; }
check 'providers wait for Crossplane, configs for providers; the app waits for nothing' \
  '[[ "$(dep crossplane-providers)" == "crossplane " && "$(dep crossplane-configs)" == "crossplane-providers " && -z "$(dep idp)" ]]' \
  "$(for n in $names; do echo "$n: $(dep "$n")"; done)"

# --- Crossplane ---------------------------------------------------------------
xp="${out[crossplane]}"
hr() { yq -N "select(.kind == \"HelmRelease\" and .metadata.name == \"$1\") | $2" <<<"$3"; }
check 'Crossplane chart is pinned' '[[ "$(hr crossplane .spec.chart.spec.version "$xp")" == 2.4.3 ]]' "$xp"
check 'Crossplane keeps the AKS Automatic settings (no Usages webhook, empty webhook dir, no aggregated roles)' \
  '[[ "$(hr crossplane ".spec.values.args[]" "$xp")" == --enable-usages=false && "$(hr crossplane .spec.values.extraEnvVarsCrossplaneInit.WEBHOOK_CONFIGS_PATH "$xp")" == /home/nonroot && "$(hr crossplane .spec.values.rbacManager.skipAggregatedClusterRoles "$xp")" == true ]]' "$xp"
check 'Crossplane installs into crossplane-system' \
  '[[ "$(hr crossplane .spec.targetNamespace "$xp")" == crossplane-system && "$(hr crossplane .spec.install.createNamespace "$xp")" == true ]]' "$xp"
probes="$(hr crossplane '.spec.postRenderers[].kustomize.patches[] | .target.name + ":" + (.patch | from_yaml | .spec.template.spec.containers[0] | (has("readinessProbe") and has("livenessProbe")) | tostring)' "$xp" | sort | tr '\n' ' ')"
check 'adds readiness and liveness probes to both Crossplane deployments' \
  '[[ "$probes" == "crossplane-rbac-manager:true crossplane:true " ]]' "$probes"
check 'never sets rules on aggregated ClusterRoles (Helm would then wipe the aggregated rules)' \
  '! grep -q "ClusterRole" <<<"$(hr crossplane ".spec.postRenderers" "$xp")"' "$xp"

# --- Crossplane providers and configs -----------------------------------------
prov="${out[crossplane-providers]}"
# shellcheck disable=SC2034 # read inside check's eval
packages="$(yq -N 'select(.kind == "Provider") | .spec.package' <<<"$prov" | sed 's/.*://' | sort -u)"
check 'all five Azure providers are pinned to one version' \
  '[[ "$(yq -N "select(.kind == \"Provider\") | .metadata.name" <<<"$prov" | wc -l | tr -d " ")" == 5 && "$packages" == v2.8.0 ]]' "$prov"
check 'provider pods run with the Crossplane workload identity' \
  '[[ "$(yq -N "select(.kind == \"DeploymentRuntimeConfig\") | .spec.serviceAccountTemplate.metadata.annotations[\"azure.workload.identity/client-id\"]" <<<"$prov")" == crossplane-client-1 ]]' "$prov"
expr="$(yq -N 'select(.kind == "Kustomization" and .metadata.name == "crossplane-providers") | .spec.healthCheckExprs[] | select(.kind == "Provider") | .current' "$FLUX_OBJECTS")"
check 'providers count as ready only once Installed and Healthy' \
  '[[ "$(yq -N "select(.kind == \"Kustomization\" and .metadata.name == \"crossplane-providers\") | .spec.wait" "$FLUX_OBJECTS")" == true && "$expr" == *"'"'"'Installed'"'"'"* && "$expr" == *"'"'"'Healthy'"'"'"* && "$expr" != *".all("* ]]' "$expr"
cfg="${out[crossplane-configs]}"
check 'ProviderConfigs authenticate with the Crossplane identity in this tenant and subscription' \
  '[[ "$(yq -N "select(.kind == \"ProviderConfig\" or .kind == \"ClusterProviderConfig\") | [.spec.clientID, .spec.tenantID, .spec.subscriptionID] | join(\",\")" <<<"$cfg" | grep . | sort -u)" == "crossplane-client-1,tenant-1,sub-1" ]]' "$cfg"
check 'the smoke-test ResourceGroup is namespaced and uses the region' \
  '[[ "$(yq -N "select(.kind == \"ResourceGroup\") | .metadata.namespace + \"/\" + .spec.forProvider.location" <<<"$cfg")" == default/westus3 ]]' "$cfg"

# --- IDP app ------------------------------------------------------------------
idp="${out[idp]}"
sel() { yq -N "select(.kind == \"$1\" and .metadata.name == \"$2\") | $3" <<<"$idp"; }
check 'the app runs the image and architecture the script built' \
  '[[ "$(sel Deployment idp-web ".spec.template.spec.containers[0].image")" == acr1.azurecr.io/idp-web:20260101000000 && "$(sel Deployment idp-web ".spec.template.spec.nodeSelector[\"kubernetes.io/arch\"]")" == amd64 ]]' "$idp"
check 'the app service account uses the portal identity' \
  '[[ "$(sel ServiceAccount idp-web ".metadata.annotations[\"azure.workload.identity/client-id\"]")" == web-client-1 ]]' "$idp"
check 'the Gateway serves the host with the managed default-domain certificate' \
  '[[ "$(sel Gateway idp-web ".spec.listeners[] | select(.name == \"https\") | .hostname + \" \" + .tls.certificateRefs[0].name")" == "idp.0123456789abcdef01234567.westus3.aksapp.io idp-web-tls" && "$(sel DefaultDomainCertificate idp-web-tls ".metadata.namespace + \"/\" + .spec.target.secret")" == idp-system/idp-web-tls ]]' "$idp"
check 'no Key Vault TLS, cert-manager or Azure DNS label remains' \
  '[[ "$idp" != *tls-cert-keyvault-uri* && "$idp" != *idp-gateway-tls* && "$idp" != *cert-manager.io* && "$idp" != *azure-dns-label-name* ]]' "$idp"
check 'both routes answer only for the host' \
  '[[ "$(yq -N "select(.kind == \"HTTPRoute\") | .spec.hostnames[]" <<<"$idp" | sort -u)" == idp.0123456789abcdef01234567.westus3.aksapp.io ]]' "$idp"
expr="$(yq -N 'select(.kind == "Kustomization" and .metadata.name == "idp") | .spec.healthCheckExprs[] | select(.kind == "DefaultDomainCertificate") | .current' "$FLUX_OBJECTS")"
check 'the app waits for its rollout and for the certificate to be Available' \
  '[[ "$(yq -N "select(.kind == \"Kustomization\" and .metadata.name == \"idp\") | .spec.wait" "$FLUX_OBJECTS")" == true && "$expr" == *"'"'"'Available'"'"'"* && "$expr" != *".all("* ]]' "$expr"

exit "$failures"

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
IMAGE_PLATFORM="${IMAGE_PLATFORM:-linux/arm64}"
IMAGE_NAME="${IMAGE_NAME:-idp-web}"
IMAGE_TAG="${IMAGE_TAG:-$(date +%Y%m%d%H%M%S)}"
SKIP_IMAGE_BUILD="${SKIP_IMAGE_BUILD:-false}"
IMAGE_REF="${IMAGE_REF:-}"
HELM_TIMEOUT="${HELM_TIMEOUT:-10m}"

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
  random_suffix="$(LC_ALL=C tr -dc 'a-z0-9' </dev/urandom | head -c 6)"
  printf '%s' "${sanitized}${random_suffix}"
}

ensure_cluster_context() {
  log "Fetching kubeconfig for $AKS_CLUSTER_NAME"
  az aks get-credentials \
    --resource-group "$RESOURCE_GROUP" \
    --name "$AKS_CLUSTER_NAME" \
    --overwrite-existing >/dev/null
}

ensure_namespaces() {
  kubectl create namespace crossplane-system --dry-run=client -o yaml | kubectl apply -f - >/dev/null
  kubectl create namespace idp-system --dry-run=client -o yaml | kubectl apply -f - >/dev/null
}

ensure_acr() {
  if [[ -z "$ACR_NAME" ]]; then
    ACR_NAME="$(generate_acr_name)"
  fi

  if az acr show --name "$ACR_NAME" >/dev/null 2>&1; then
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
  helm upgrade --install crossplane crossplane-stable/crossplane \
    --namespace crossplane-system \
    --create-namespace \
    --wait \
    --timeout "$HELM_TIMEOUT"
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

  kubectl apply -f "$ROOT_DIR/platform/crossplane/configs/cluster-provider-config.yaml"

  sed "s|LOCATION_PLACEHOLDER|$LOCATION|g" \
    "$ROOT_DIR/platform/crossplane/examples/resourcegroup-smoke-test.yaml" | kubectl apply -f -
}

build_and_push_image() {
  if [[ -n "$IMAGE_REF" && "$SKIP_IMAGE_BUILD" == "true" ]]; then
    log "Skipping image build and using explicit image reference $IMAGE_REF"
    return
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

deploy_idp() {
  [[ -f "$IDP_ENV_FILE" ]] || fail "App environment file not found at $IDP_ENV_FILE. Create it from .env.example first."
  [[ -n "$IMAGE_REF" ]] || fail "IMAGE_REF is empty. Build the image first or set IMAGE_REF."

  log "Applying IDP base resources"
  kubectl apply -f "$ROOT_DIR/platform/kubernetes/idp/base.yaml"

  log "Creating application env secret from $IDP_ENV_FILE"
  kubectl -n idp-system create secret generic idp-app-env \
    --from-env-file="$IDP_ENV_FILE" \
    --dry-run=client -o yaml | kubectl apply -f -

  log "Deploying IDP app"
  sed "s|IMAGE_PLACEHOLDER|$IMAGE_REF|g" \
    "$ROOT_DIR/platform/kubernetes/idp/deployment.yaml" | kubectl apply -f -

  kubectl -n idp-system rollout status deployment/idp-web --timeout=5m
}

main() {
  require_tool az
  require_tool kubectl
  require_tool helm

  ensure_cluster_context
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
  log "To access the starter deployment: kubectl -n idp-system port-forward svc/idp-web 3000:80"
}

main "$@"
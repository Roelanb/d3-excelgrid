#!/bin/bash
set -euo pipefail

#===============================================================================
# d3-excelgrid - K3S Deployment Script (Podman)
#===============================================================================
# Builds and pushes images using podman, then deploys to a VPS running K3S.
# Namespace: reportai
# Registry:  registry.beecoders.com
#
# Usage:
#   ./scripts/deploy-k3s.sh [all|build|push|deploy|status]
#
# Required tools locally:
#   podman, ssh, scp
#===============================================================================

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

COMMAND="${1:-all}"

# Match example script registry
REGISTRY="${REGISTRY:-beecodersregistry.azurecr.io}"
NAMESPACE="reportai"

# VPS target (override via environment variables)
VPS_IP="${VPS_IP:-212.47.77.32}"
VPS_USER="${VPS_USER:-bart}"

VPS_BASE_DIR="${VPS_BASE_DIR:-~/reportai}"
VPS_K8S_DIR="$VPS_BASE_DIR/k8s"

# Image names
SQLREST_IMAGE="$REGISTRY/reportai-sqlrest"
REPORTGEN_IMAGE="$REGISTRY/reportai-reportgenerator"
EXCEL_GRID_IMAGE="$REGISTRY/reportai-excel-grid"
REPORTMAKER_IMAGE="$REGISTRY/reportai-reportmaker"

ssh_vps() {
  local cmd="$1"
  ssh -o StrictHostKeyChecking=accept-new "$VPS_USER@$VPS_IP" "bash -lc $(printf %q "$cmd")"
}

kubectl_vps() {
  local args="$1"
  ssh_vps "if command -v kubectl >/dev/null 2>&1; then kubectl $args; else sudo k3s kubectl $args; fi"
}

check_deps() {
  command -v podman >/dev/null 2>&1 || { echo "podman not found"; exit 1; }
  command -v ssh >/dev/null 2>&1 || { echo "ssh not found"; exit 1; }
  command -v scp >/dev/null 2>&1 || { echo "scp not found"; exit 1; }
}

build_images() {
  echo "Building images with podman..."

  podman build -t "$SQLREST_IMAGE:latest" -f "$ROOT_DIR/sqlrest/Dockerfile" "$ROOT_DIR"
  podman build -t "$REPORTGEN_IMAGE:latest" -f "$ROOT_DIR/reportgenerator/Dockerfile" "$ROOT_DIR"

  podman build -t "$EXCEL_GRID_IMAGE:latest" -f "$ROOT_DIR/excel-grid/Dockerfile" "$ROOT_DIR/excel-grid"
  podman build -t "$REPORTMAKER_IMAGE:latest" -f "$ROOT_DIR/reportmaker/Dockerfile" "$ROOT_DIR/reportmaker"
}

push_images() {
  echo "Logging into registry $REGISTRY..."
  if [[ -n "${REGISTRY_USER:-}" && -n "${REGISTRY_PASSWORD:-}" ]]; then
    podman login -u "$REGISTRY_USER" -p "$REGISTRY_PASSWORD" "$REGISTRY"
  else
    podman login "$REGISTRY"
  fi

  echo "Pushing images..."
  podman push "$SQLREST_IMAGE:latest"
  podman push "$REPORTGEN_IMAGE:latest"
  podman push "$EXCEL_GRID_IMAGE:latest"
  podman push "$REPORTMAKER_IMAGE:latest"
}

deploy_manifests() {
  echo "Deploying manifests to $VPS_USER@$VPS_IP (namespace: $NAMESPACE)..."

  # Ensure a working directory on the VPS
  ssh_vps "mkdir -p $VPS_K8S_DIR || (command -v sudo >/dev/null 2>&1 && sudo mkdir -p $VPS_K8S_DIR && sudo chown -R $VPS_USER:$VPS_USER $VPS_BASE_DIR)"

  # Copy manifests
  scp -o StrictHostKeyChecking=accept-new -r "$ROOT_DIR/k8s/reportai" "$VPS_USER@$VPS_IP:$VPS_K8S_DIR/"

  # Apply
  kubectl_vps "apply -f $VPS_K8S_DIR/reportai/namespace.yaml"

  # NOTE: user must create sqlrest-secrets; we ship an example only
  if ! kubectl_vps "-n $NAMESPACE get secret sqlrest-secrets >/dev/null 2>&1"; then
    echo "WARNING: Missing secret '$NAMESPACE/sqlrest-secrets'."
    echo "         Create it from: k8s/reportai/sqlrest-secret.example.yaml"
  fi

  # NOTE: required for pulling from private registry
  if ! kubectl_vps "-n $NAMESPACE get secret acr-secret >/dev/null 2>&1"; then
    echo "WARNING: Missing secret '$NAMESPACE/acr-secret' (imagePullSecret)."
    echo "         Create it so K3S can pull images from $REGISTRY."
  fi

  kubectl_vps "apply -f $VPS_K8S_DIR/reportai/runtime-configs.yaml"
  kubectl_vps "apply -f $VPS_K8S_DIR/reportai/sqlrest.yaml"
  kubectl_vps "apply -f $VPS_K8S_DIR/reportai/reportgenerator.yaml"
  kubectl_vps "apply -f $VPS_K8S_DIR/reportai/excel-grid.yaml"
  kubectl_vps "apply -f $VPS_K8S_DIR/reportai/reportmaker.yaml"
  kubectl_vps "apply -f $VPS_K8S_DIR/reportai/ingress.yaml"

  echo "Done. If this is the first deploy, create your Secret from sqlrest-secret.example.yaml."
}

status() {
  kubectl_vps "-n $NAMESPACE get pods,svc,ingress"
}

main() {
  check_deps

  case "$COMMAND" in
    all)
      build_images
      push_images
      deploy_manifests
      status
      ;;
    build)
      build_images
      ;;
    push)
      push_images
      ;;
    deploy)
      deploy_manifests
      ;;
    status)
      status
      ;;
    *)
      echo "Unknown command: $COMMAND"
      echo "Usage: $0 [all|build|push|deploy|status]"
      exit 1
      ;;
  esac
}

main

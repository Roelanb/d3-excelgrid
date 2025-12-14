#!/bin/bash
set -e

#===============================================================================
# FactoryAI - VPS Deployment Script (Podman)
#===============================================================================
# Deploys catalog and orchestrator containers to a VPS running podman
#
# Usage:
#   ./scripts/deploy-vps.sh [command] [options]
#
# Commands:
#   all         - Build, push, and deploy everything (default)
#   build       - Build container images locally
#   push        - Push images to registry
#   deploy      - Deploy containers to VPS
#   status      - Check deployment status
#   logs        - View container logs
#   stop        - Stop containers on VPS
#   restart     - Restart containers on VPS
#
# Options:
#   --no-cache  - Build without cache
#   --only=X    - Only process catalog or orchestrator
#===============================================================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# VPS Configuration
VPS_IP="212.47.77.32"
VPS_USER="bart"
REGISTRY="registry.beecoders.com"

# Container Configuration
CATALOG_IMAGE="$REGISTRY/factoryai-catalog"
ORCHESTRATOR_IMAGE="$REGISTRY/factoryai-orchestrator"
CATALOG_PORT="5010"
ORCHESTRATOR_PORT="5020"

# Parse arguments
COMMAND="${1:-all}"
NO_CACHE=""
ONLY=""
DIRECT_TRANSFER=false

for arg in "$@"; do
    case $arg in
        --no-cache)
            NO_CACHE="--no-cache"
            ;;
        --only=*)
            ONLY="${arg#*=}"
            ;;
        --direct)
            DIRECT_TRANSFER=true
            ;;
    esac
done

#===============================================================================
# Helper Functions
#===============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

check_dependencies() {
    log_step "Checking Dependencies"

    local missing=()

    # Check for docker or podman
    if command -v docker &> /dev/null; then
        CONTAINER_CMD="docker"
        log_success "docker $(docker --version | head -1)"
    elif command -v podman &> /dev/null; then
        CONTAINER_CMD="podman"
        log_success "podman $(podman --version | head -1)"
    else
        missing+=("docker or podman")
    fi

    # Check for ssh
    if ! command -v ssh &> /dev/null; then
        missing+=("ssh")
    else
        log_success "ssh available"
    fi

    if [ ${#missing[@]} -ne 0 ]; then
        log_error "Missing dependencies:"
        for dep in "${missing[@]}"; do
            echo "  - $dep"
        done
        exit 1
    fi
}

ssh_vps() {
    ssh -o StrictHostKeyChecking=accept-new "$VPS_USER@$VPS_IP" "$@"
}

#===============================================================================
# Build Functions
#===============================================================================

build_images() {
    log_step "Building Container Images"

    if [ -z "$ONLY" ] || [ "$ONLY" = "orchestrator" ]; then
        log_info "Building orchestrator image..."
        # Build from project root to include schemas directory
        $CONTAINER_CMD build $NO_CACHE -t "$ORCHESTRATOR_IMAGE:latest" \
            -f "$ROOT_DIR/orchestrator/Dockerfile" \
            "$ROOT_DIR"
        log_success "Orchestrator image built"
    fi

    if [ -z "$ONLY" ] || [ "$ONLY" = "catalog" ]; then
        log_info "Building catalog image..."
        $CONTAINER_CMD build $NO_CACHE -t "$CATALOG_IMAGE:latest" \
            -f "$ROOT_DIR/catalog/Dockerfile" \
            "$ROOT_DIR/catalog"
        log_success "Catalog image built"
    fi
}

#===============================================================================
# Push Functions
#===============================================================================

push_images() {
    if [ "$DIRECT_TRANSFER" = true ]; then
        push_images_direct
        return
    fi

    log_step "Pushing Images to Registry"

    log_info "Logging into registry..."
    echo "Please enter registry credentials if prompted."
    $CONTAINER_CMD login "$REGISTRY" || {
        log_error "Failed to login to registry. Run: $CONTAINER_CMD login $REGISTRY"
        exit 1
    }

    if [ -z "$ONLY" ] || [ "$ONLY" = "orchestrator" ]; then
        log_info "Pushing orchestrator image..."
        $CONTAINER_CMD push "$ORCHESTRATOR_IMAGE:latest"
        log_success "Orchestrator image pushed"
    fi

    if [ -z "$ONLY" ] || [ "$ONLY" = "catalog" ]; then
        log_info "Pushing catalog image..."
        $CONTAINER_CMD push "$CATALOG_IMAGE:latest"
        log_success "Catalog image pushed"
    fi
}

push_images_direct() {
    log_step "Transferring Images Directly to VPS (bypassing registry)"

    mkdir -p /tmp/factoryai-images

    if [ -z "$ONLY" ] || [ "$ONLY" = "orchestrator" ]; then
        log_info "Saving orchestrator image..."
        $CONTAINER_CMD save "$ORCHESTRATOR_IMAGE:latest" | gzip > /tmp/factoryai-images/orchestrator.tar.gz
        log_info "Transferring orchestrator image to VPS..."
        scp -o StrictHostKeyChecking=accept-new /tmp/factoryai-images/orchestrator.tar.gz "$VPS_USER@$VPS_IP:/tmp/"
        log_info "Loading orchestrator image on VPS..."
        ssh_vps "gunzip -c /tmp/orchestrator.tar.gz | podman load"
        ssh_vps "rm /tmp/orchestrator.tar.gz"
        rm /tmp/factoryai-images/orchestrator.tar.gz
        log_success "Orchestrator image transferred"
    fi

    if [ -z "$ONLY" ] || [ "$ONLY" = "catalog" ]; then
        log_info "Saving catalog image..."
        $CONTAINER_CMD save "$CATALOG_IMAGE:latest" | gzip > /tmp/factoryai-images/catalog.tar.gz
        log_info "Transferring catalog image to VPS..."
        scp -o StrictHostKeyChecking=accept-new /tmp/factoryai-images/catalog.tar.gz "$VPS_USER@$VPS_IP:/tmp/"
        log_info "Loading catalog image on VPS..."
        ssh_vps "gunzip -c /tmp/catalog.tar.gz | podman load"
        ssh_vps "rm /tmp/catalog.tar.gz"
        rm /tmp/factoryai-images/catalog.tar.gz
        log_success "Catalog image transferred"
    fi

    rmdir /tmp/factoryai-images 2>/dev/null || true
}

#===============================================================================
# Deploy Functions
#===============================================================================

deploy_containers() {
    log_step "Deploying Containers to VPS"

    log_info "Connecting to VPS at $VPS_IP..."

    # Only login to registry if not using direct transfer
    if [ "$DIRECT_TRANSFER" = false ]; then
        log_info "Logging into registry on VPS..."
        ssh_vps "podman login $REGISTRY" || {
            log_warn "Registry login may have failed - continuing anyway"
        }
    fi

    # Create network if it doesn't exist
    log_info "Creating container network..."
    ssh_vps "podman network create factoryai 2>/dev/null || true"

    # Create data directories
    log_info "Creating data directories..."
    ssh_vps "mkdir -p /opt/factoryai/data /opt/factoryai/builds /opt/factoryai/schemas"

    # Copy schemas to VPS
    log_info "Copying database schemas..."
    scp -o StrictHostKeyChecking=accept-new \
        "$ROOT_DIR/schemas/duckdb-schema.sql" \
        "$ROOT_DIR/schemas/d1-schema.sql" \
        "$VPS_USER@$VPS_IP:/opt/factoryai/schemas/"

    if [ -z "$ONLY" ] || [ "$ONLY" = "orchestrator" ]; then
        log_info "Deploying orchestrator..."

        # Stop and remove existing container
        ssh_vps "podman stop factoryai-orchestrator 2>/dev/null || true"
        ssh_vps "podman rm factoryai-orchestrator 2>/dev/null || true"

        # Pull latest image (skip if using direct transfer - already loaded)
        if [ "$DIRECT_TRANSFER" = false ]; then
            ssh_vps "podman pull $ORCHESTRATOR_IMAGE:latest"
        fi

        # Run orchestrator container
        ssh_vps "podman run -d \
            --name factoryai-orchestrator \
            --network factoryai \
            --restart unless-stopped \
            -p $ORCHESTRATOR_PORT:8080 \
            -v /opt/factoryai/data:/app/data:Z \
            -v /opt/factoryai/builds:/app/builds:Z \
            -v /opt/factoryai/schemas:/schemas:ro,Z \
            -e ASPNETCORE_ENVIRONMENT=Production \
            -e Database__Path=/app/data/factoryai.duckdb \
            -e Database__SchemaPath=/schemas/duckdb-schema.sql \
            -e Build__Directory=/app/builds \
            $ORCHESTRATOR_IMAGE:latest"

        log_success "Orchestrator deployed on port $ORCHESTRATOR_PORT"
    fi

    if [ -z "$ONLY" ] || [ "$ONLY" = "catalog" ]; then
        log_info "Deploying catalog..."

        # Stop and remove existing container
        ssh_vps "podman stop factoryai-catalog 2>/dev/null || true"
        ssh_vps "podman rm factoryai-catalog 2>/dev/null || true"

        # Pull latest image (skip if using direct transfer - already loaded)
        if [ "$DIRECT_TRANSFER" = false ]; then
            ssh_vps "podman pull $CATALOG_IMAGE:latest"
        fi

        # Run catalog container
        ssh_vps "podman run -d \
            --name factoryai-catalog \
            --network factoryai \
            --restart unless-stopped \
            -p $CATALOG_PORT:80 \
            --add-host=orchestrator:host-gateway \
            $CATALOG_IMAGE:latest"

        log_success "Catalog deployed on port $CATALOG_PORT"
    fi

    log_success "Deployment complete!"
    echo ""
    echo "Services:"
    echo "  Catalog:      http://$VPS_IP:$CATALOG_PORT"
    echo "  Orchestrator: http://$VPS_IP:$ORCHESTRATOR_PORT"
    echo "  Health:       http://$VPS_IP:$ORCHESTRATOR_PORT/health"
}

#===============================================================================
# Status & Management
#===============================================================================

show_status() {
    log_step "Deployment Status"

    log_info "Checking containers on VPS..."
    ssh_vps "podman ps -a --filter 'name=factoryai' --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"

    echo ""
    log_info "Checking health endpoints..."

    # Check orchestrator health
    if curl -s --connect-timeout 5 "http://$VPS_IP:$ORCHESTRATOR_PORT/health" > /dev/null 2>&1; then
        log_success "Orchestrator is healthy"
    else
        log_warn "Orchestrator health check failed"
    fi

    # Check catalog
    if curl -s --connect-timeout 5 "http://$VPS_IP:$CATALOG_PORT/" > /dev/null 2>&1; then
        log_success "Catalog is responding"
    else
        log_warn "Catalog is not responding"
    fi
}

show_logs() {
    log_step "Container Logs"

    local container="${2:-orchestrator}"

    log_info "Showing logs for factoryai-$container..."
    ssh_vps "podman logs --tail 100 -f factoryai-$container" || {
        log_error "Failed to get logs. Container may not exist."
    }
}

stop_containers() {
    log_step "Stopping Containers"

    if [ -z "$ONLY" ] || [ "$ONLY" = "orchestrator" ]; then
        log_info "Stopping orchestrator..."
        ssh_vps "podman stop factoryai-orchestrator 2>/dev/null || true"
    fi

    if [ -z "$ONLY" ] || [ "$ONLY" = "catalog" ]; then
        log_info "Stopping catalog..."
        ssh_vps "podman stop factoryai-catalog 2>/dev/null || true"
    fi

    log_success "Containers stopped"
}

restart_containers() {
    log_step "Restarting Containers"

    if [ -z "$ONLY" ] || [ "$ONLY" = "orchestrator" ]; then
        log_info "Restarting orchestrator..."
        ssh_vps "podman restart factoryai-orchestrator"
    fi

    if [ -z "$ONLY" ] || [ "$ONLY" = "catalog" ]; then
        log_info "Restarting catalog..."
        ssh_vps "podman restart factoryai-catalog"
    fi

    log_success "Containers restarted"
}

run_all() {
    check_dependencies
    build_images
    push_images
    deploy_containers
    show_status
}

#===============================================================================
# Main Entry Point
#===============================================================================

main() {
    echo ""
    echo -e "${CYAN}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║         FactoryAI - VPS Deployment (Podman)               ║${NC}"
    echo -e "${CYAN}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""

    case "$COMMAND" in
        all)
            run_all
            ;;
        build)
            check_dependencies
            build_images
            ;;
        push)
            check_dependencies
            push_images
            ;;
        deploy)
            check_dependencies
            deploy_containers
            ;;
        status)
            show_status
            ;;
        logs)
            show_logs "$@"
            ;;
        stop)
            stop_containers
            ;;
        restart)
            restart_containers
            ;;
        help|--help|-h)
            echo "Usage: $0 [command] [options]"
            echo ""
            echo "Commands:"
            echo "  all         Build, push, and deploy everything (default)"
            echo "  build       Build container images locally"
            echo "  push        Push images to registry"
            echo "  deploy      Deploy containers to VPS"
            echo "  status      Check deployment status"
            echo "  logs        View container logs (logs orchestrator|catalog)"
            echo "  stop        Stop containers on VPS"
            echo "  restart     Restart containers on VPS"
            echo "  help        Show this help message"
            echo ""
            echo "Options:"
            echo "  --no-cache      Build without cache"
            echo "  --only=X        Only process 'catalog' or 'orchestrator'"
            echo "  --direct        Transfer images directly via SCP (bypass registry)"
            echo ""
            echo "Environment Variables:"
            echo "  VPS_USER        SSH user for VPS (default: bart)"
            echo ""
            echo "Examples:"
            echo "  $0                           # Full deployment via registry"
            echo "  $0 --direct                  # Full deployment via direct transfer"
            echo "  $0 build --only=orchestrator # Build only orchestrator"
            echo "  $0 push --direct             # Transfer images without registry"
            echo "  $0 deploy                    # Deploy without rebuilding"
            echo "  $0 logs orchestrator         # View orchestrator logs"
            echo "  $0 status                    # Check deployment status"
            echo ""
            ;;
        *)
            log_error "Unknown command: $COMMAND"
            echo "Run '$0 help' for usage information"
            exit 1
            ;;
    esac
}

main "$@"

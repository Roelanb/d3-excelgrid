#!/bin/bash

# Script to start the sqlrest backend and both frontend applications
# Usage: ./start-all.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -i :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to kill process on a port
kill_port() {
    local port=$1
    local pids=$(lsof -i :$port -sTCP:LISTEN -t 2>/dev/null)
    if [ ! -z "$pids" ]; then
        for pid in $pids; do
            print_warning "Killing process $pid on port $port"
            kill -9 $pid 2>/dev/null || true
        done
        sleep 2
    fi
}

# Function to start a service in background
start_service() {
    local service_name=$1
    local command=$2
    local directory=$3
    local port=$4

    print_status "Starting $service_name..."

    # Check if port is already in use
    if check_port $port; then
        print_warning "Port $port is already in use. Killing existing process..."
        kill_port $port
    fi

    # Start the service (use absolute paths for logs and pids)
    cd "$PROJECT_ROOT/$directory"
    $command > "$PROJECT_ROOT/logs/${service_name}.log" 2>&1 &
    local pid=$!
    echo $pid > "$PROJECT_ROOT/pids/${service_name}.pid"

    # Wait a moment and check if it started successfully
    sleep 3
    if kill -0 $pid 2>/dev/null; then
        print_success "$service_name started successfully (PID: $pid, Port: $port)"
    else
        print_error "$service_name failed to start. Check logs/${service_name}.log"
        return 1
    fi
}

# Create necessary directories
mkdir -p logs pids

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

print_status "Starting all services for d3-excelgrid project..."
echo ""

# Check dependencies
print_status "Checking dependencies..."

# Check for .NET (including common non-standard locations)
DOTNET_CMD=""
if command -v dotnet &> /dev/null; then
    DOTNET_CMD="dotnet"
elif [ -x "$HOME/.dotnet/dotnet" ]; then
    DOTNET_CMD="$HOME/.dotnet/dotnet"
elif [ -x "/usr/share/dotnet/dotnet" ]; then
    DOTNET_CMD="/usr/share/dotnet/dotnet"
else
    print_error ".NET CLI not found. Please install .NET 9.0 SDK."
    exit 1
fi
print_status "Using .NET from: $DOTNET_CMD"

# Check for Node.js and npm/pnpm
if ! command -v node &> /dev/null; then
    print_error "Node.js not found. Please install Node.js."
    exit 1
fi

# Check for pnpm (preferred) or npm
if command -v pnpm &> /dev/null; then
    PKG_MANAGER="pnpm"
elif command -v npm &> /dev/null; then
    PKG_MANAGER="npm"
else
    print_error "Neither pnpm nor npm found. Please install one of them."
    exit 1
fi

print_success "Dependencies check completed. Using $PKG_MANAGER as package manager."
echo ""

# Start SQLRest backend
print_status "Starting SQLRest backend..."
if [ ! -f "sqlrest/.env" ]; then
    print_warning "No .env file found in sqlrest directory. Using default configuration."
    if [ -f "sqlrest/.env.example" ]; then
        cp sqlrest/.env.example sqlrest/.env
        print_status "Created .env from example. Please review sqlrest/.env file."
    fi
fi

start_service "sqlrest" "$DOTNET_CMD run --project SqlRest.csproj --urls http://localhost:3200" "sqlrest" 3200
echo ""

# Start Report Generator API
print_status "Starting Report Generator API..."
cd "$PROJECT_ROOT"
start_service "reportgenerator" "$DOTNET_CMD run --urls http://localhost:3210" "reportgenerator" 3210
echo ""

# Install dependencies and start Excel Grid frontend
print_status "Installing dependencies for Excel Grid..."
cd "$PROJECT_ROOT/excel-grid"
if [ "$PKG_MANAGER" = "pnpm" ]; then
    pnpm install
else
    npm install
fi

cd "$PROJECT_ROOT"
start_service "excel-grid" "npx vite --port 3220" "excel-grid" 3220
echo ""

# Install dependencies and start ReportMaker frontend
print_status "Installing dependencies for ReportMaker..."
cd "$PROJECT_ROOT/reportmaker"
if [ "$PKG_MANAGER" = "pnpm" ]; then
    pnpm install
else
    npm install
fi

cd "$PROJECT_ROOT"
start_service "reportmaker" "npx vite --port 3230" "reportmaker" 3230
echo ""

# Final status
print_success "All services started successfully!"
echo ""
print_status "Service URLs:"
echo "  • SQLRest API:        http://localhost:3200"
echo "  • Report Generator:   http://localhost:3210"
echo "  • Excel Grid:         http://localhost:3220"
echo "  • ReportMaker:        http://localhost:3230"
echo ""
print_status "API Documentation:"
echo "  • SQLRest Swagger:    http://localhost:3200/swagger"
echo "  • ReportGen Swagger:  http://localhost:3210/swagger"
echo ""
print_status "Logs and PIDs:"
echo "  • Logs directory:  $PROJECT_ROOT/logs/"
echo "  • PIDs directory:  $PROJECT_ROOT/pids/"
echo ""
print_status "To stop all services, run:"
echo "  ./stop-all.sh"
echo ""
print_status "To view logs, run:"
echo "  tail -f logs/sqlrest.log"
echo "  tail -f logs/reportgenerator.log"
echo "  tail -f logs/excel-grid.log"
echo "  tail -f logs/reportmaker.log"

#!/bin/bash

# Script to stop all running services
# Usage: ./stop-all.sh

# Don't use set -e as we want to continue even if some commands fail

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

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

print_status "Stopping all services..."

# Function to stop service by PID file
stop_service() {
    local service_name=$1
    local pid_file="pids/${service_name}.pid"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 $pid 2>/dev/null; then
            print_status "Stopping $service_name (PID: $pid)..."
            kill $pid
            sleep 2
            
            # Force kill if still running
            if kill -0 $pid 2>/dev/null; then
                print_warning "Force killing $service_name..."
                kill -9 $pid
            fi
            
            print_success "$service_name stopped"
        else
            print_warning "$service_name was not running"
        fi
        rm -f "$pid_file"
    else
        print_warning "No PID file found for $service_name"
    fi
}

# Stop all services
stop_service "sqlrest"
stop_service "reportgenerator"
stop_service "excel-grid"
stop_service "reportmaker"

# Also kill any processes on the expected ports (including IPv6)
print_status "Checking for remaining processes on ports..."

for port in 3200 3210 3220 3230; do
    pids=$(lsof -i :$port -sTCP:LISTEN -t 2>/dev/null)
    if [ ! -z "$pids" ]; then
        for pid in $pids; do
            print_warning "Killing remaining process $pid on port $port"
            kill -9 $pid 2>/dev/null || true
        done
    fi
done

# Final check - ensure all ports are free
sleep 1
remaining=0
for port in 3200 3210 3220 3230; do
    if lsof -i :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        remaining=1
        print_error "Port $port is still in use!"
    fi
done

if [ $remaining -eq 0 ]; then
    print_success "All services stopped successfully!"
else
    print_error "Some services could not be stopped. Check manually with: lsof -i :3200 -i :3210 -i :3220 -i :3230"
    exit 1
fi

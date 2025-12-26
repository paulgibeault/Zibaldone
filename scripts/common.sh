#!/bin/bash

# Colors for output
export GREEN='\033[0;32m'
export BLUE='\033[0;34m'
export RED='\033[0;31m'
export YELLOW='\033[0;33m'
export NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}$1${NC}"
}

log_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}Warning: $1${NC}"
}

log_error() {
    echo -e "${RED}Error: $1${NC}"
}

# Function to check if a process is running on a port
is_port_in_use() {
    lsof -i ":$1" -t >/dev/null 2>&1
}

# Function to kill process on port
kill_port() {
    local port=$1
    local pid=$(lsof -i ":$port" -t | head -n 1)
    if [ -n "$pid" ]; then
        kill "$pid" 2>/dev/null
        sleep 1
        if ps -p "$pid" >/dev/null 2>&1; then
            kill -9 "$pid" 2>/dev/null
        fi
    fi
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}
# Function to ask for confirmation
confirm() {
    if [ "$FORCE" = true ]; then
        return 0
    fi
    read -p "$1 [y/N] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        return 0
    else
        return 1
    fi
}

#!/bin/bash

# Dependencies provided by main scripts

check_docker() {
    if command_exists docker; then
        if docker info >/dev/null 2>&1; then
            return 0
        else
            return 2 # Docker installed but daemon not running
        fi
    else
        return 1
    fi
}

install_docker() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        if command_exists brew; then
            log_info "Installing Docker CLI and Colima via Homebrew..."
            brew install docker colima
        else
            log_error "Homebrew not found. Please install Docker and Colima manually."
            exit 1
        fi
    else
        log_error "Automatic Docker installation currently only supported on macOS. Please install Docker manually."
        exit 1
    fi
}

start_docker_daemon() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        log_info "Starting Colima..."
        colima start
        docker context use colima >/dev/null 2>&1 || true
    else
        log_error "Please start Docker daemon manually."
        exit 1
    fi
}

cleanup_docker() {
    local full=$1
    
    if [ "$full" = true ]; then
        if command_exists brew; then
             if confirm "Uninstall Docker CLI and Colima via Homebrew (and remove ALL data)?"; then
                 log_info "Stopping services and removing Docker/Colima..."
                 docker compose down --rmi all --volumes --remove-orphans 2>/dev/null || true
                 colima stop || true
                 brew uninstall docker colima
                 if [ -d "$HOME/.colima" ]; then
                     rm -rf "$HOME/.colima"
                     log_success "Removed Colima data (~/.colima)"
                 fi
                 log_success "Uninstalled Docker and Colima"
                 return 0
             fi
        fi
    fi

    # Standard (non-full or declined) cleanup: just stop containers if they are running
    if command_exists docker; then
        if docker info >/dev/null 2>&1; then
            log_info "Stopping Zibaldone containers..."
            docker compose down 2>/dev/null || true
        fi
    fi
}

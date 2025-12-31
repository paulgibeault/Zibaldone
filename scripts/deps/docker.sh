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
            log_info "Installing Docker CLI, Docker Compose, and Colima via Homebrew..."
            brew install docker docker-compose colima
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

determine_docker_compose() {
    if command_exists docker && docker compose version >/dev/null 2>&1; then
        export DOCKER_COMPOSE_CMD="docker compose"
    elif command_exists docker-compose; then
        export DOCKER_COMPOSE_CMD="docker-compose"
    else
        log_error "Neither 'docker compose' nor 'docker-compose' found. Please install one."
        exit 1
    fi
}

cleanup_docker() {
    local full=$1
    
    # Ensure we have a command to use
    if [ -z "$DOCKER_COMPOSE_CMD" ]; then
         determine_docker_compose
    fi

    if [ "$full" = true ]; then
        if command_exists brew; then
             if confirm "Uninstall Docker CLI and Colima via Homebrew (and remove ALL data)?"; then
                 log_info "Stopping services and removing Docker/Colima..."
                 $DOCKER_COMPOSE_CMD down --rmi all --volumes --remove-orphans 2>/dev/null || true
                 colima stop || true
                 brew uninstall docker docker-compose colima
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
            $DOCKER_COMPOSE_CMD down 2>/dev/null || true
        fi
    fi
}

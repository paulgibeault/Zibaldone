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
        # 1. Calculate Resources
        local total_ram_bytes=$(sysctl -n hw.memsize)
        local total_ram_gb=$((total_ram_bytes / 1024 / 1024 / 1024))
        local total_cpu=$(sysctl -n hw.ncpu)

        # Target: Half of system resources, but clamped
        local target_ram=$((total_ram_gb / 2))
        local target_cpu=$((total_cpu / 2))

        # Clamp RAM: Min 4GB, Max 16GB
        if (( target_ram < 4 )); then target_ram=4; fi
        if (( target_ram > 16 )); then target_ram=16; fi

        # Clamp CPU: Min 2, Max 8
        if (( target_cpu < 2 )); then target_cpu=2; fi
        if (( target_cpu > 8 )); then target_cpu=8; fi

        log_info "Resource Planning: System has ${total_ram_gb}GB RAM / ${total_cpu} CPUs. Targeting Colima: ${target_ram}GB RAM / ${target_cpu} CPUs."

        # 2. Check Colima Status
        if ! command_exists colima; then
             log_error "Colima not found. Install it first."
             return 1
        fi

        if colima status >/dev/null 2>&1; then
             # It is running. Check if we need to resize.
             # Note: Parsing 'colima status' output is brittle, so we rely on user manually handling major changes usually,
             # but we can check if it's running with *default* low resources (2GB).
             # For robustness, we will just Log it for now, or force restart if specifically asked.
             # BUT user asked to "update setup script to set comila up with more resources... when rebuilt"
             # So we should probably default to restarting if config is wildly off or just rely on the start line.
             
             # Simpler approach: If running, just let it be, but warn. 
             # Implementation: Stop and Start creates downtime. 
             # Let's try to be smart: 'colima start' handles reconfiguration if flags are passed?
             # No, colima start on running instance usually just ensures it's running.
             
             # We will just stop and clean start to ensure resources are applied if we are in a 'setup' phase that implies reconfiguration.
             log_info "Colima is running. Restarting to ensure resource application..."
             colima stop
        fi

        log_info "Starting Colima with ${target_ram}GB RAM and ${target_cpu} CPUs..."
        colima start --cpu "$target_cpu" --memory "$target_ram"
        
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
            log_info "Stopping Zibaldone containers and removing local images..."
            $DOCKER_COMPOSE_CMD down --rmi local 2>/dev/null || true
        fi
    fi
}

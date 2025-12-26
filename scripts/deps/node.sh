#!/bin/bash

# Dependencies provided by main scripts

check_node() {
    if command_exists node && command_exists npm; then
        return 0
    else
        return 1
    fi
}

install_node() {
    if command_exists brew; then
        log_info "Installing Node.js via Homebrew..."
        brew install node
    else
        log_error "Homebrew not found. Please install Node.js manually: https://nodejs.org/"
        exit 1
    fi
}

setup_frontend_deps() {
    log_info "Setting up Frontend..."
    cd frontend
    if [ ! -d "node_modules" ]; then
        npm install
    else
        log_info "Node modules already installed, skipping (use --force to reinstall)."
    fi
    cd ..
    log_success "Frontend dependencies installed."
}

cleanup_node() {
    local full=$1
    log_info "Cleaning up Frontend..."
    if [ -d "frontend/node_modules" ]; then
        rm -rf frontend/node_modules
        log_success "Removed frontend/node_modules"
    fi
    
    if [ "$full" = true ]; then
        if command_exists brew; then
            if confirm "Uninstall Node.js via Homebrew?"; then
                brew uninstall node
                log_success "Uninstalled Node.js"
            fi
        fi
    fi
}

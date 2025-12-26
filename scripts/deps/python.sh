#!/bin/bash

# Dependencies provided by main scripts

check_python() {
    if command_exists python3; then
        return 0
    else
        return 1
    fi
}

install_python() {
    if command_exists brew; then
        log_info "Installing Python 3 via Homebrew..."
        brew install python
    else
        log_error "Homebrew not found. Please install Python 3 manually: https://www.python.org/downloads/"
        exit 1
    fi
}

setup_backend_venv() {
    log_info "Setting up Backend Environment..."
    cd backend
    if [ ! -d ".venv" ]; then
        python3 -m venv .venv
    fi
    source .venv/bin/activate
    pip install -U pip >/dev/null
    pip install -r requirements.txt
    pip install 'litellm[proxy]'
    cd ..
    log_success "Backend environment ready."
}

cleanup_python() {
    local full=$1
    log_info "Cleaning up Backend..."
    if [ -d "backend/.venv" ]; then
        rm -rf backend/.venv
        log_success "Removed backend/.venv"
    fi
    
    if [ "$full" = true ]; then
        if command_exists brew; then
            if confirm "Uninstall Python 3 via Homebrew?"; then
                brew uninstall python
                log_success "Uninstalled Python 3"
            fi
        fi
    fi
}

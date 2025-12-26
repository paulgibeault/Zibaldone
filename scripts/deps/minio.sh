#!/bin/bash

# Dependencies provided by main scripts

check_minio() {
    if command_exists minio && command_exists mc; then
        return 0
    else
        return 1
    fi
}

install_minio() {
    if command_exists brew; then
        log_info "Installing MinIO Server and Client via Homebrew..."
        brew install minio/stable/minio minio/stable/mc
    else
        log_error "Homebrew not found. Please install MinIO manually."
        exit 1
    fi
}

cleanup_minio() {
    local full=$1
    log_info "Cleaning up MinIO..."
    if [ "$full" = true ]; then
        if [ -d "data/minio_data" ]; then
            rm -rf data/minio_data
            log_success "Removed data/minio_data"
        fi
        if [ -d "data/blob_storage" ]; then
            rm -rf data/blob_storage
            log_success "Removed data/blob_storage"
        fi
    fi
    
    if [ "$full" = true ]; then
        if command_exists brew; then
            if confirm "Uninstall MinIO Server and Client via Homebrew?"; then
                brew uninstall minio/stable/minio minio/stable/mc
                log_success "Uninstalled MinIO tools"
            fi
        fi
    fi
}

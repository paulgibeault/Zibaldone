#!/bin/bash

# Unified service management for Zibaldone

source scripts/common.sh
source scripts/config.sh

# Service PIDs (for local mode)
PID_LITELLM=""
PID_BACKEND=""
PID_FRONTEND=""
PID_MINIO=""

# Function to stop all local services
stop_local_services() {
    log_info "\nStopping local services..."
    
    # Identify PIDs from ports if not set
    [ -z "$PID_LITELLM" ] && PID_LITELLM=$(lsof -i :4000 -t | head -n 1)
    [ -z "$PID_BACKEND" ] && PID_BACKEND=$(lsof -i :8000 -t | head -n 1)
    [ -z "$PID_FRONTEND" ] && PID_FRONTEND=$(lsof -i :5173 -t | head -n 1)
    [ -z "$PID_MINIO" ] && PID_MINIO=$(lsof -i :9000 -t | head -n 1)

    # Send SIGTERM to all known services
    [ -n "$PID_LITELLM" ] && kill "$PID_LITELLM" 2>/dev/null
    [ -n "$PID_BACKEND" ] && kill "$PID_BACKEND" 2>/dev/null
    [ -n "$PID_FRONTEND" ] && kill "$PID_FRONTEND" 2>/dev/null
    [ -n "$PID_MINIO" ] && kill "$PID_MINIO" 2>/dev/null
    
    # Wait up to 3 seconds for graceful exit
    local count=0
    while [ $count -lt 3 ]; do
        local alive=false
        for pid in $PID_LITELLM $PID_BACKEND $PID_FRONTEND $PID_MINIO; do
            if [ -n "$pid" ] && ps -p "$pid" >/dev/null 2>&1; then
                alive=true
                break
            fi
        done
        if [ "$alive" = false ]; then
            break
        fi
        sleep 1
        ((count++))
    done
    
    # Force kill any remaining processes
    for pid in $PID_LITELLM $PID_BACKEND $PID_FRONTEND $PID_MINIO; do
        if [ -n "$pid" ] && ps -p "$pid" >/dev/null 2>&1; then
            kill -9 "$pid" 2>/dev/null
        fi
    done
    
    log_success "All services stopped."
}

# Function to wait for a service to be healthy
wait_for_service() {
    local url=$1
    local name=$2
    local timeout=${3:-30}
    local count=0
    
    log_info "Waiting for ${name} to be ready..."
    until curl -s "$url" >/dev/null || [ $count -eq $timeout ]; do
        sleep 1
        ((count++))
    done
    
    if [ $count -eq $timeout ]; then
        log_error "${name} failed to start within ${timeout} seconds."
        return 1
    fi
    return 0
}

# Local service starters
start_minio_local() {
    log_info "Starting local MinIO..."
    export MINIO_ROOT_USER=$(grep S3_ACCESS_KEY backend/.env | cut -d'=' -f2)
    export MINIO_ROOT_PASSWORD=$(grep S3_SECRET_KEY backend/.env | cut -d'=' -f2)
    mkdir -p data/minio_data
    minio server data/minio_data --address :9000 --console-address :9001 > /dev/null 2>&1 &
    PID_MINIO=$!
    
    # Ensure bucket exists
    sleep 2
    mc alias set local_zibaldone http://localhost:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD >/dev/null 2>&1
    mc mb local_zibaldone/zibaldone-blobs 2>/dev/null || true
}

start_litellm_local() {
    log_info "Starting LiteLLM Proxy..."
    source backend/.venv/bin/activate
    litellm --config litellm_config.yaml --host 0.0.0.0 --port 4000 > /dev/null 2>&1 &
    PID_LITELLM=$!
}

start_backend_local() {
    log_info "Starting Backend..."
    cd backend
    export $(grep -v '^#' .env | xargs)
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 > /dev/null 2>&1 &
    PID_BACKEND=$!
    cd ..
}

start_frontend_local() {
    log_info "Starting Frontend..."
    cd frontend
    npm run dev -- --host --port 5173 > /dev/null 2>&1 &
    PID_FRONTEND=$!
    cd ..
}

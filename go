#!/bin/bash

# Source modular scripts
source scripts/common.sh
source scripts/config.sh
source scripts/deps/python.sh
source scripts/deps/node.sh
source scripts/deps/docker.sh
source scripts/deps/minio.sh

load_config

RESTART=false
# Argument parsing
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --docker) ZIB_MODE="docker" ;;
        --local) ZIB_MODE="local" ;;
        --restart) RESTART=true ;;
        --help)
            echo "Usage: ./go [OPTIONS]"
            echo "Options:"
            echo "  --docker    Run in Docker mode"
            echo "  --local     Run in Local mode"
            echo "  --restart   Force restart services"
            exit 0
            ;;
        *) log_error "Unknown parameter passed: $1"; exit 1 ;;
    esac
    shift
done

if [ -z "$ZIB_MODE" ]; then
    log_error "Project not configured. Please run ./setup first."
    exit 1
fi

log_info "=== Starting Zibaldone ($ZIB_MODE Mode) ==="

# Cleanup function for local mode
cleanup_local() {
    log_info "\nStopping local services..."
    [ -n "$PID_LITELLM" ] && kill "$PID_LITELLM" 2>/dev/null
    [ -n "$PID_BACKEND" ] && kill "$PID_BACKEND" 2>/dev/null
    [ -n "$PID_FRONTEND" ] && kill "$PID_FRONTEND" 2>/dev/null
    [ -n "$PID_MINIO" ] && kill "$PID_MINIO" 2>/dev/null
    wait 2>/dev/null
    exit
}

if [ "$ZIB_MODE" = "docker" ]; then
    if [ "$(check_docker)" = "2" ]; then
        start_docker_daemon
    fi
    
    if [ "$RESTART" = true ]; then
        docker compose down
    fi
    
    docker compose up --build -d
    log_info "Streaming logs (Ctrl+C to stop services)..."
    
    echo -e "\n${GREEN}🚀 Zibaldone is running!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  Frontend UI:  http://localhost:3000${NC}"
    echo -e "${GREEN}  Backend API:  http://localhost:8000${NC}"
    echo -e "${GREEN}  LiteLLM:      http://localhost:4000${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    docker compose logs -f
else
    # Register trap for cleanup
    trap cleanup_local SIGINT SIGTERM
    
    # Check Ports
    if [ "$RESTART" = true ]; then
        kill_port 4000
        kill_port 8000
        kill_port 5173
        kill_port 9000
    fi
    
    for port in 4000 8000 5173 9000; do
        if is_port_in_use $port; then
            log_error "Port $port is already in use. Run with --restart to kill existing processes."
            exit 1
        fi
    done

    # Start MinIO locally if needed
    STORAGE_TYPE=$(grep STORAGE_TYPE backend/.env | cut -d'=' -f2)
    if [ "$ZIB_MODE" = "local" ] && [ "$STORAGE_TYPE" = "s3" ] && [[ "$(grep S3_ENDPOINT backend/.env)" == *"localhost"* ]]; then
        log_info "Starting local MinIO..."
        export MINIO_ROOT_USER=$(grep S3_ACCESS_KEY backend/.env | cut -d'=' -f2)
        export MINIO_ROOT_PASSWORD=$(grep S3_SECRET_KEY backend/.env | cut -d'=' -f2)
        minio server data/minio_data --address :9000 --console-address :9001 > /dev/null 2>&1 &
        PID_MINIO=$!
        
        # Ensure bucket exists
        sleep 2
        mc alias set local_zibaldone http://localhost:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD >/dev/null 2>&1
        mc mb local_zibaldone/zibaldone-blobs 2>/dev/null || true
    fi

    # Start LiteLLM Proxy if in local mode
    if [ "$ZIB_MODE" = "local" ]; then
        log_info "Starting LiteLLM Proxy..."
        source backend/.venv/bin/activate
        litellm --config litellm_config.yaml --host 0.0.0.0 --port 4000 > /dev/null 2>&1 &
        PID_LITELLM=$!
    fi

    # Start Backend
    log_info "Starting Backend..."
    cd backend
    export $(grep -v '^#' .env | xargs)
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 > /dev/null 2>&1 &
    PID_BACKEND=$!
    cd ..

    # Start Frontend
    log_info "Starting Frontend..."
    cd frontend
    npm run dev -- --host --port 5173 > /dev/null 2>&1 &
    PID_FRONTEND=$!
    cd ..

    log_success "All services running!"
    echo -e "\n${GREEN}🚀 Zibaldone is running!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  Frontend UI: http://localhost:5173${NC}"
    echo -e "${GREEN}  Backend API: http://localhost:8000${NC}"
    echo -e "${GREEN}  LiteLLM:     http://localhost:4000${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    # Wait for background processes
    wait
fi

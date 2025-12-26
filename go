#!/bin/bash

# Source modular scripts
source scripts/common.sh
source scripts/config.sh
source scripts/services.sh
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

if [ "$ZIB_MODE" = "docker" ]; then
    if ! check_docker; then
        start_docker_daemon
    fi
    
    if [ "$RESTART" = true ]; then
        docker compose down
    fi
    
    docker compose up --build -d
    
    echo -e "\n${GREEN}🚀 Zibaldone is running!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  Frontend UI:  http://localhost:3000${NC}"
    echo -e "${GREEN}  Backend API:  http://localhost:8000${NC}"
    echo -e "${GREEN}  LiteLLM:      http://localhost:4000${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    log_info "Streaming logs (Ctrl+C to stop services)..."
    docker compose logs -f
else
    # Local mode
    trap stop_local_services SIGINT SIGTERM
    
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

    # Start Services
    STORAGE_TYPE=$(grep STORAGE_TYPE backend/.env | cut -d'=' -f2)
    if [ "$ZIB_MODE" = "local" ] && [ "$STORAGE_TYPE" = "s3" ] && [[ "$(grep S3_ENDPOINT backend/.env)" == *"localhost"* ]]; then
        start_minio_local
    fi

    if [ "$ZIB_MODE" = "local" ]; then
        start_litellm_local
    fi

    start_backend_local
    start_frontend_local

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

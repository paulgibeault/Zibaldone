#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Default values
USE_DOCKER=false
RESTART=false

# Simple argument parsing
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --docker) USE_DOCKER=true ;;
        --restart) RESTART=true ;;
        --help)
            echo "Usage: ./go [OPTIONS]"
            echo "Options:"
            echo "  --docker    Run using Docker Compose"
            echo "  --restart   Force restart by killing existing processes/containers"
            echo "  --help      Show this help message"
            exit 0
            ;;
        *) echo "Unknown parameter passed: $1"; exit 1 ;;
    esac
    shift
done

echo -e "${BLUE}=== Starting Zibaldone ($(if [ "$USE_DOCKER" = true ]; then echo "Docker"; else echo "Local"; fi) Mode) ===${NC}"

# Function to recursively kill descendants of a PID
kill_descendants() {
    local pid=$1
    local children=$(pgrep -P "$pid")

    for child in $children; do
        kill_descendants "$child"
    done

    # Kill the process itself if it exists
    if kill -0 "$pid" 2>/dev/null; then
        kill "$pid" 2>/dev/null
    fi
}

# Function to kill background processes on exit
cleanup() {
    if [ "$USE_DOCKER" = true ]; then
        echo -e "\n${RED}Stopping Docker services...${NC}"
        docker compose down
    else
        echo -e "\n${RED}Stopping all local services...${NC}"
        
        # Kill specific PIDs if they were captured
        if [ -n "$PID_LITELLM" ]; then
            echo -e "${YELLOW}Stopping LiteLLM (PID $PID_LITELLM)...${NC}"
            kill_descendants "$PID_LITELLM"
        fi
        
        if [ -n "$PID_BACKEND" ]; then
            echo -e "${YELLOW}Stopping Backend (PID $PID_BACKEND)...${NC}"
            kill_descendants "$PID_BACKEND"
        fi
        
        if [ -n "$PID_FRONTEND" ]; then
             echo -e "${YELLOW}Stopping Frontend (PID $PID_FRONTEND)...${NC}"
             kill_descendants "$PID_FRONTEND"
        fi
        
        if [ -n "$PID_MINIO" ]; then
             echo -e "${YELLOW}Stopping MinIO (PID $PID_MINIO)...${NC}"
             kill_descendants "$PID_MINIO"
        fi

        # Fallback: kill any remaining direct children of this script
        kill $(jobs -p) 2>/dev/null
    fi
    
    exit
}
trap cleanup SIGINT SIGTERM

# 0. Check Dependencies
echo -e "${BLUE}[0/4] Checking Dependencies...${NC}"

if [ "$USE_DOCKER" = true ]; then
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}Error: docker is not installed.${NC}"
        exit 1
    fi
    
    # Check if daemon is running
    if ! docker info &> /dev/null; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            echo -e "${YELLOW}Docker daemon is not reachable. Attempting to start Colima...${NC}"
            if command -v colima &> /dev/null; then
                colima start
            else
                echo -e "${RED}Error: Colima not found. Please start Docker manually.${NC}"
                exit 1
            fi
        else
            echo -e "${RED}Error: Docker daemon is not running.${NC}"
            exit 1
        fi
    fi
else
    if ! command -v python3 &> /dev/null; then
        echo -e "${RED}Error: python3 is not installed.${NC}"
        exit 1
    fi

    if ! command -v npm &> /dev/null; then
        echo -e "${RED}Error: npm is not installed.${NC}"
        exit 1
    fi
fi

# 1. Check for Local LLM Server
if [ -z "$SKIP_LLM_CHECK" ]; then
    echo -e "${BLUE}[1/4] Checking for Local LLM Server...${NC}"
    
    # Extract port from litellm_config.yaml (simple grep/cut)
    # If file doesn't exist, we might be in a fresh clone, use default
    if [ -f "litellm_config.yaml" ]; then
        LLM_URL=$(grep "api_base" litellm_config.yaml | head -n 1 | awk -F'"' '{print $2}')
        if [ -z "$LLM_URL" ]; then
            LLM_PORT=1234
        else
            # Extract port, handle both localhost and host.docker.internal
            LLM_PORT=$(echo $LLM_URL | sed -E 's/.*:([0-9]+).*/\1/')
        fi
    else
        LLM_PORT=1234
    fi

    # Check if port is open using netcat (nc)
    # Host-side check is always against localhost since LM Studio runs on host
    if ! nc -z localhost $LLM_PORT 2>/dev/null; then
        echo -e "${RED}Error: Local LLM server not found on port ${LLM_PORT}${NC}"
        echo -e "${YELLOW}Please start the Local Server in LM Studio.${NC}"
        echo -e "See ${BLUE}docs/lm_studio_setup.md${NC} for instructions."
        echo -e "To skip this check, run: ${BLUE}SKIP_LLM_CHECK=1 ./go${NC}"
        exit 1
    else
        echo -e "${GREEN}✓ Local LLM server found on port ${LLM_PORT}${NC}"
    fi
fi

# Function to check if a port is in use and offer to kill the process
check_port() {
    local port=$1
    local name=$2
    
    if lsof -i :$port -t >/dev/null 2>&1; then
        local pid=$(lsof -i :$port -t | head -n 1)
        local cmd=$(ps -p $pid -o command= | head -n 1)
        
        if [ "$RESTART" = true ]; then
            echo -e "${YELLOW}Port $port ($name) is in use by PID $pid, killing for restart...${NC}"
            KILL_CONFIRMED=true
        else
            echo -e "${RED}Error: Port $port ($name) is already in use by PID $pid:${NC}"
            echo -e "${YELLOW}  $cmd${NC}"
            read -p "  Would you like to kill this process? [y/N] " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                KILL_CONFIRMED=true
            else
                KILL_CONFIRMED=false
            fi
        fi

        if [ "$KILL_CONFIRMED" = true ]; then
            echo -e "${BLUE}  Killing PID $pid...${NC}"
            kill $pid 2>/dev/null
            sleep 1
            if ps -p $pid > /dev/null 2>&1; then
                echo -e "${YELLOW}  Process still running. Sending SIGKILL...${NC}"
                kill -9 $pid 2>/dev/null
                sleep 1
            fi

            if lsof -i :$port -t >/dev/null 2>&1; then
                 echo -e "${RED}  Failed to kill process. Please manually free port $port.${NC}"
                 exit 1
            else
                 echo -e "${GREEN}  ✓ Port $port freed.${NC}"
            fi
        else
            echo -e "${RED}  Cannot start $name while port $port is in use.${NC}"
            exit 1
        fi
    fi
}

if [ "$USE_DOCKER" = true ]; then
    # Docker Implementation
    echo -e "${BLUE}[2/4] Preparing Docker Environment...${NC}"
    
    if [ "$RESTART" = true ]; then
        echo -e "${YELLOW}Stopping existing containers...${NC}"
        docker compose down
    fi

    # Check ports to ensure they are free for the bridge
    check_port 4000 "LiteLLM (Docker Proxy)"
    check_port 8000 "Backend (Docker Proxy)"
    check_port 3000 "Frontend (Docker Proxy)"
    check_port 9000 "MinIO API (Docker Proxy)"
    check_port 9001 "MinIO Console (Docker Proxy)"

    echo -e "${GREEN}[4/4] Starting Docker Services...${NC}"
    # Use --build to ensure changes are picked up, -d to run in background
    # Actually, we can just run docker compose up and let it stream logs, 
    # but we want to handle the exit gracefully.
    docker compose up --build -d

    echo -e "\n${YELLOW}=== Docker Services Running ===${NC}"
    echo -e "Frontend:  http://localhost:3000"
    echo -e "Backend:   http://localhost:8000"
    echo -e "LiteLLM:   http://localhost:4000"
    echo -e "\nStreaming logs (Press Ctrl+C to stop services):"
    
    docker compose logs -f
else
    # Local Implementation
    # 2. Setup Backend Environment (First Run)
    echo -e "${BLUE}[2/4] Setting up Backend...${NC}"

    if [ ! -d "backend/.venv" ]; then
        echo -e "${YELLOW}Creating Python virtual environment...${NC}"
        python3 -m venv backend/.venv
        source backend/.venv/bin/activate
        echo -e "${YELLOW}Installing dependencies...${NC}"
        pip install -r backend/requirements.txt
    else
        source backend/.venv/bin/activate
    fi

    # 3. Setup Frontend (First Run)
    echo -e "${BLUE}[3/4] Setting up Frontend...${NC}"
    if [ ! -d "frontend/node_modules" ]; then
        echo -e "${YELLOW}Installing frontend dependencies...${NC}"
        cd frontend
        npm install
        cd ..
    fi

    # 4. Start Services
    echo -e "${GREEN}[4/4] Starting Services...${NC}"

    check_port 4000 "LiteLLM"
    check_port 8000 "Backend"
    check_port 5173 "Frontend"

    # Check if S3 is configured and if MinIO needs to be started
    STORAGE_TYPE=$(grep STORAGE_TYPE backend/.env | cut -d'=' -f2)
    if [ "$STORAGE_TYPE" = "s3" ]; then
        if ! nc -z localhost 9000 2>/dev/null; then
            echo -e "${YELLOW}STORAGE_TYPE=s3 but local MinIO not found on port 9000.${NC}"
            echo -e "${BLUE}Launching local MinIO server...${NC}"
            
            # Use data/minio_data as the storage backend
            mkdir -p data/minio_data
            
            # Export credentials for MinIO
            export MINIO_ROOT_USER=$(grep S3_ACCESS_KEY backend/.env | cut -d'=' -f2)
            export MINIO_ROOT_PASSWORD=$(grep S3_SECRET_KEY backend/.env | cut -d'=' -f2)
            
            minio server data/minio_data --address :9000 --console-address :9001 > /dev/null 2>&1 &
            PID_MINIO=$!
            echo -e "${BLUE}  -> MinIO running (PID: $PID_MINIO)${NC}"
            
            # Wait for MinIO to be ready
            echo -e "${BLUE}Waiting for MinIO...${NC}"
            for i in {1..10}; do
                if nc -z localhost 9000 2>/dev/null; then
                    echo -e "${GREEN}✓ MinIO is ready.${NC}"
                    break
                fi
                sleep 2
            done
            
            # Setup bucket using mc
            echo -e "${BLUE}Ensuring bucket existence...${NC}"
            mc alias set local_zibaldone http://localhost:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD > /dev/null 2>&1
            mc mb local_zibaldone/zibaldone-blobs 2>/dev/null || true
            echo -e "${GREEN}✓ Bucket 'zibaldone-blobs' ready.${NC}"
        fi
    fi

    # Start LiteLLM Proxy
    litellm --config litellm_config.yaml --host 0.0.0.0 --port 4000 > /dev/null 2>&1 &
    PID_LITELLM=$!
    echo -e "${BLUE}  -> LiteLLM running (PID: $PID_LITELLM)${NC}"

    # Start Backend
    cd backend
    # Export env vars from .env for local run to ensure boto3 finds them
    export $(grep -v '^#' .env | xargs)
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
    PID_BACKEND=$!
    echo -e "${BLUE}  -> Backend running (PID: $PID_BACKEND)${NC}"
    cd ..

    # Start Frontend
    cd frontend
    npm run dev -- --host &
    PID_FRONTEND=$!
    echo -e "${BLUE}  -> Frontend running (PID: $PID_FRONTEND)${NC}"
    cd ..

    echo -e "\n${YELLOW}=== All Services Running ===${NC}"
    echo -e "Frontend:  http://localhost:5173"
    echo -e "Backend:   http://localhost:8000"
    echo -e "LiteLLM:   http://localhost:4000"
    echo -e "\nPress Ctrl+C to stop everything."

    # Wait for all processes
    wait
fi

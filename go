#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Starting Zibaldone ===${NC}"

# Function to kill background processes on exit
cleanup() {
    echo -e "\n${RED}Stopping all services...${NC}"
    kill $(jobs -p) 2>/dev/null
    exit
}
trap cleanup SIGINT SIGTERM

# 0. Check Dependencies
echo -e "${BLUE}[0/4] Checking Dependencies...${NC}"

if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Error: python3 is not installed.${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed.${NC}"
    exit 1
fi

# 1. Check for Local LLM Server
if [ -z "$SKIP_LLM_CHECK" ]; then
    echo -e "${BLUE}[1/4] Checking for Local LLM Server...${NC}"
    
    # Extract port from litellm_config.yaml (simple grep/cut)
    LLM_URL=$(grep "api_base" litellm_config.yaml | head -n 1 | awk -F'"' '{print $2}')
    
    if [ -z "$LLM_URL" ]; then
        LLM_PORT=1234
    else
        LLM_PORT=$(echo $LLM_URL | sed -E 's/.*:([0-9]+).*/\1/')
    fi

    # Check if port is open using netcat (nc)
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
    
    # Check if port is in use (lsof is more reliable on Mac than netstat/ss for this)
    if lsof -i :$port -t >/dev/null 2>&1; then
        local pid=$(lsof -i :$port -t | head -n 1)
        # Get process name/command for better context
        local cmd=$(ps -p $pid -o command= | head -n 1)
        
        echo -e "${RED}Error: Port $port ($name) is already in use by PID $pid:${NC}"
        echo -e "${YELLOW}  $cmd${NC}"
        
        read -p "  Would you like to kill this process? [y/N] " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
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

# Check ports before starting
check_port 4000 "LiteLLM"
check_port 8000 "Backend"
check_port 5173 "Frontend"

# Start LiteLLM Proxy
litellm --config litellm_config.yaml --host 0.0.0.0 --port 4000 > /dev/null 2>&1 &
PID_LITELLM=$!
echo -e "${BLUE}  -> LiteLLM running (PID: $PID_LITELLM)${NC}"

# Start Backend
cd backend
# Explicitly use 0.0.0.0 to match the remote access requirements
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
echo -e "Frontend:  http://localhost:5173 (or your local IP)"
echo -e "Backend:   http://localhost:8000"
echo -e "LiteLLM:   http://localhost:4000"
echo -e "\nPress Ctrl+C to stop everything."

# Wait for all processes
wait

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

# 1. Activate Backend Environment
source backend/.venv/bin/activate

# 2. Start LiteLLM Proxy
echo -e "${GREEN}[1/3] Starting LiteLLM Proxy...${NC}"
litellm --config litellm_config.yaml --host 0.0.0.0 --port 4000 > /dev/null 2>&1 &
PID_LITELLM=$!
echo -e "${BLUE}  -> LiteLLM running (PID: $PID_LITELLM)${NC}"

# 3. Start Backend
echo -e "${GREEN}[2/3] Starting Backend (Uvicorn)...${NC}"
cd backend
# Explicitly use 0.0.0.0 to match the remote access requirements
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
PID_BACKEND=$!
echo -e "${BLUE}  -> Backend running (PID: $PID_BACKEND)${NC}"
cd ..

# 4. Start Frontend
echo -e "${GREEN}[3/3] Starting Frontend (Vite)...${NC}"
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

# Go Script Documentation

The `go` script is the single command to launch the entire Zibaldone stack (Frontend + Backend + LLM). It orchestrates multiple processes and handles graceful shutdowns.

## Usage
Run from the project root:
```bash
./go
```

## What It Does
The script orchestrates the startup of three parallel services:

### 1. Checks & Activations
*   **Cleanup Trap**: Registers a system trap. If you press `Ctrl+C`, the script catches the signal and automatically kills all background processes (`liteLLM`, `uvicorn`, `vite`) so no orphan processes are left running.
*   **Environment**: Activates the `backend/.venv` automatically.

### 2. Service Startup
All services are started in the background (using `&`), allowing them to run concurrently in the same terminal window.

#### A. LiteLLM Proxy (Port 4000)
*   **Command**: `litellm --config litellm_config.yaml --host 0.0.0.0 --port 4000`
*   **Role**: Acts as the bridge between Zibaldone and your local models (e.g., LM Studio).
*   **Access**: Listens on all interfaces (`0.0.0.0`), making it accessible to other devices if needed.

#### B. Backend Server (Port 8000)
*   **Command**: `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
*   **Role**: The main Python API for Zibaldone.
*   **Features**:
    *   `--reload`: Auto-reloads code on change (dev mode).
    *   `--host 0.0.0.0`: **Enables Remote Access**. This allows your phone/laptop to connect to the backend.

#### C. Frontend Server (Port 5173/5174)
*   **Command**: `npm run dev -- --host`
*   **Role**: The React/Vite user interface.
*   **Features**:
    *   `--host`: Exposes the UI to the local network so you can test on mobile.

## Accessing the App
Once running, the script prints the addresses:
*   **Local**: `http://localhost:5173`
*   **Remote**: `http://<your-mac-ip>:5173` (e.g., `192.168.1.50:5173`)

## Stopping
Simply press `Ctrl+C` in the terminal. The script will intercept the signal and shut down all three services cleanly.

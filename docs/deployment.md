# Zibaldone Operations & Deployment Guide

This guide covers how to manage the Zibaldone service, including installation, daily operation, and troubleshooting. It provides instructions for both the native script-based approach and the Docker Compose method.

## Native Management (Recommended for Development)

We provide a set of scripts in the root directory to manage the application lifecycle.

### 1. Initial Setup: `./setup`

Run this script first to prepare your environment.

```bash
./setup
```

**What it does:**
- Checks for system dependencies (Python 3, Node.js, npm).
- Guides you through configuring the Local LLM connection (e.g., connecting to LM Studio).
- Creates a `litellm_config.yaml` based on your choices.
- Generates `backend/.env` with necessary API keys and URLs.
- Creates a Python virtual environment (`backend/.venv`) and installs dependencies.
- Installs frontend dependencies (`npm install`).

### 2. Start Services: `./go`

Use this script to start the application.

```bash
./go
```

**What it does:**
- Checks if required ports (4000, 8000, 5173) are available.
- If ports are in use, it offers to kill the blocking processes (useful if a previous run didn't exit cleanly).
- Starts three concurrent background processes:
    1. **LiteLLM Proxy** (Port 4000): Bridges the backend to your local LLM.
    2. **Backend API** (Port 8000): The main application server.
    3. **Frontend Dev Server** (Port 5173): The user interface (Vite).
- Traps `Ctrl+C` to shut down all services gracefully when you interrupt the script.

### 3. Clean Reset: `./cleanup`

Use this script to wipe the slate clean.

```bash
./cleanup
```

**What it does:**
- Deletes `node_modules` and virtual environments.
- Removes configuration files (`.env`, `litellm_config.yaml`).
- **Warning**: This destroys your configuration. You will need to run `./setup` again.

---

## Container Deployment (Colima)

For a consistent, isolated runtime, we use **Colima** (Containers on Linux Machines). This is an open-source, lightweight alternative to Docker Desktop.

### 1. Prerequisites: Install Colima

**Automated Setup (Recommended)**

We provide a script to handle the setup automatically:

```bash
./setup_colima
```

This script will:
1. Install Colima and Docker CLI via Homebrew.
2. Start the Colima runtime.
3. Validate that `docker` commands can connect to the Colima daemon.

**Manual Setup**

If you prefer to install manually:

```bash
brew install colima docker docker-compose
colima start
```

### 2. Verify Runtime

Ensure the daemon is active:

```bash
docker info
```

You should see output indicating the server version (often referencing "Lima").

### 3. Running with Docker Compose

Once Colima is running, you can use standard Docker commands.

1. **Verify Configuration**: Ensure `litellm_config.yaml` exists.
2. **Start Services**:
    ```bash
    docker-compose up --build
    ```

**Services Started:**
- `litellm`: The LLM proxy container.
- `backend`: The FastAPI server container.
- `frontend`: The React/Nginx container.

Access the application at `http://localhost:3000`.

### Troubleshooting

#### "Cannot connect to the Docker daemon"
- **Cause**: Colima is stopped.
- **Fix**: Run `colima start`.

#### Networking & Host Access
- Colima handles networking slightly differently than Docker Desktop, but `host.docker.internal` is generally supported.
- If you have issues connecting to LM Studio on the host:
    - Ensure LM Studio is listening on `0.0.0.0`.
    - Verify `colima` was started with default network settings (which usually works out of the box).

---

## Troubleshooting & FAQ

### "Port already in use"
If `./go` fails because a port is taken:
1. The script will try to identify the PID and ask if you want to kill it. Say 'y'.
2. If that fails, manually kill it: `lsof -ti :8000 | xargs kill -9`.

### LLM Integration Issues
- **Error**: "Connection refused" to LLM.
- **Fix**:
    - Ensure LM Studio server is running.
    - Check `litellm_config.yaml` to see if the URL is correct.
    - If running in Docker, remember `localhost` inside a container is not your Mac's `localhost`. Use `host.docker.internal`.

### "Module not found"
- Run `./setup` again to ensure all dependencies are installed.
- Check if you are active in the virtual environment if running commands manually.

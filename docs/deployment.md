# Operations & Deployment Guide

This guide covers how to run Zibaldone using either the recommended **Docker Compose** stack (for stability and feature completeness) or the **Native Scripts** (for rapid development).

---

## 1. Quick Start (Docker Compose)

The easiest way to run Zibaldone is with Docker Compose. This brings up the entire stack, including the **MinIO** storage server, which handles robust file storage.

### Prerequisites
*   Docker Desktop or Colima
*   A local LLM server running (e.g., LM Studio/Ollama) or an OpenAI API key.

### Setup

1.  **Configure LLM**: Ensure `litellm_config.yaml` is present in the root.
    *   *Tip: Run `./setup` once to generate a default config if you don't have one.*
2.  **Start Services**:
    ```bash
    docker-compose up --build
    ```

### Services Overview
| Service | Port | Description |
| :--- | :--- | :--- |
| **Frontend** | `3000` | Access the UI at `http://localhost:3000` |
| **Backend** | `8000` | API Server |
| **LiteLLM** | `4000` | LLM Proxy Gateway |
| **MinIO** | `9000/9001` | S3-Compatible Storage & Console |
| **create-buckets** | - | One-off script to initialize MinIO buckets |

---

## 2. Native Development Scripts

For developers modifying the code, we provide helper scripts in the root directory.

### `./setup`
**One-time initialization.**
*   Creates Python virtual environment (`backend/.venv`).
*   Installs Python dependencies.
*   Installs Node.js dependencies (`frontend/node_modules`).
*   Generates default `.env` and `litellm_config.yaml`.

### `./go`
**The "Run" button.**
*   Traps `Ctrl+C` to kill all child processes on exit.
*   Starts **Backend** (port 8000) with hot-reload.
*   Starts **Frontend** (port 5173).
*   Starts **LiteLLM** (port 4000).
*   *Note: Native mode defaults to Local Filesystem storage (`data/blob_storage`) unless configured otherwise.*

### `./cleanup`
**Factory Reset.**
*   **WARNING**: Deletes all configuration, virtual and environments, and `node_modules`.
*   Use this if your environment is corrupted and you want to start fresh.

---

## 3. Configuration

Key environment variables in `backend/.env`:

*   **`STORAGE_TYPE`**:
    *   `filesystem`: (Default) Simple local storage.
    *   `s3`: Enables MinIO/S3 storage. Requires S3 credentials.
*   **`LLM_MODEL`**: The model name string passed to LiteLLM (e.g., `openai/gpt-4o`, `ollama/llama3`).

---

## 4. Troubleshooting

### "Connection Refused" to LLM
*   If running in Docker, your local LLM (LM Studio) must be accessible from *inside* the container.
*   Use `host.docker.internal` instead of `localhost` in your `litellm_config.yaml`.

### MinIO Buckets Not Created
*   If the `create-buckets` container fails, the backend might error on upload.
*   Check logs: `docker-compose logs create-buckets`.
*   Manual Fix: Open MinIO Console (`http://localhost:9001`), login with `zibaldoneadmin` / `zibaldonepassword`, and create a bucket named `zibaldone-blobs`.

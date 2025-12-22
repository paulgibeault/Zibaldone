# Setup Script Documentation

The `setup` script is an automated bootstrap tool designed to get your Zibaldone environment ready from scratch with a single command.

## Usage
Run from the project root:
```bash
./setup
```

## What It Does
The script performs a sequential 5-step process:

### 1. System Dependency Check
Verifies that the core tools are installed on your OS:
*   `python3`: Required for the backend.
*   `node`: Required for the frontend.
*   `npm`: Package manager for the frontend.
*   *If any are missing, the script exits with an error.*

### 2. Backend Initialization
*   **Virtual Environment**: Creates a Python virtual environment at `backend/.venv` if it doesn't exist.
*   **Dependencies**: Installs all required packages from `backend/requirements.txt`.
*   **LiteLLM**: Explicitly installs `litellm[proxy]` to enable the LLM proxy service.
*   **Configuration**: Checks for `backend/.env`. If missing, it creates one with default values tailored for local/LM Studio usage:
    ```bash
    LLM_MODEL=lmstudio-model
    OPENAI_API_BASE=http://localhost:4000
    ```

### 3. Frontend Initialization
*   Navigates to `frontend/`.
*   Runs `npm install` to download node modules.
*   *Skips installation if `node_modules` already exists to save time.*

### 4. Global Configuration
Generates the `litellm_config.yaml` in the root directory if it's missing.
*   **Defaults**: Pre-configured for **LM Studio** (connecting to `localhost:1234`) and specifically the `gpt-oss-20b` model.
*   **Fallbacks**: Includes a config block for standard OpenAI (`gpt-3.5-turbo`) if you provide an API key later.

### 5. Readiness Check
Finally, it activates the virtual environment and confirms that crucial CLI tools (`uvicorn`, `litellm`) are actually runnable.

## Troubleshooting
*   **Permission Denied**: Run `chmod +x setup` to make it executable.
*   **Python Errors**: Ensure you have Python 3.8+ installed.

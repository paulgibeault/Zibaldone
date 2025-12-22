# Cleanup Script Documentation

The `cleanup` script is a utility to reset your Zibaldone workspace. It deletes all auto-generated files, dependencies, and configurations created by the `setup` script.

## Usage
Run from the project root:
```bash
./cleanup
```
To bypass the confirmation prompt (useful for automated testing):
```bash
./cleanup -y
```

## What It Removes
Running this script effectively "factory resets" your environment locally.

### 1. Backend Artifacts
*   `backend/.venv`: The Python virtual environment.
*   `backend/.env`: The generated environment variables file.
*   `__pycache__`: Compiled Python bytecodes.

### 2. Frontend Artifacts
*   `frontend/node_modules`: All installed Node.js dependencies.

### 3. Global Artifacts
*   `litellm_config.yaml`: The generated configuration file for the LLM proxy.

## When to Use It
*   **Testing Setup**: To verify that `./setup` works correctly from a clean slate.
*   **Corrupted Environment**: If your dependencies get messed up, cleaning and re-running setup is often the fastest fix.
*   **Disk Space**: To free up space if you're not working on the project for a while (`node_modules` and venvs can be large).

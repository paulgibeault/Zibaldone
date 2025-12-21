# LLM Setup Guide

This guide helps you set up a local LLM environment using **Ollama** or **LM Studio**, configure **LiteLLM** as a proxy, and connect the **Zibaldone** service to it.

## 1. Install a Local LLM Provider

Choose either Ollama (command-line focused, simple) or LM Studio (GUI, versatile).

### Option A: Ollama
1.  **Download & Install**: Visit [ollama.com](https://ollama.com) and download the installer for your OS (Mac, Linux, Windows).
2.  **Pull a Model**: Open your terminal and run:
    ```bash
    ollama pull llama3
    ```
    (Or any other model like `mistral`, `gemma`, etc.)
3.  **Verify**: Run `ollama run llama3 "Hello"` to check if it's working.
4.  **Serve**: Ollama runs on `http://localhost:11434` by default.

### Option B: LM Studio
1.  **Download & Install**: Visit [lmstudio.ai](https://lmstudio.ai).
2.  **Download a Model**: Use the search bar to find a model (e.g., "Meta Llama 3") and download a quantized version (e.g., Q4_K_M).
3.  **Start Local Server**:
    *   Go to the "Local Server" tab (monitor icon).
    *   Select the downloaded model at the top.
    *   **Configuration**:
        *   Port: `1234` (default).
        *   Ensure "Cross-Origin-Resource-Sharing (CORS)" is enabled if needed (usually fine defaults).
    *   Click **Start Server**.

---

## 2. Install and Configure LiteLLM

[LiteLLM](https://docs.litellm.ai/) acts as a universal proxy, allowing Zibaldone to talk to *any* LLM using the OpenAI format.

### Installation
In your terminal (separate from Zibaldone server):

```bash
pip install 'litellm[proxy]'
```

### Configuration (`litellm_config.yaml`)
Create a file named `litellm_config.yaml` with the following content. This maps "model names" to your actual backend.

```yaml
model_list:
  # Option A: Connecting to Ollama
  - model_name: ollama-llama3
    litellm_params:
      model: ollama/llama3
      api_base: "http://localhost:11434" # Default Ollama URL

  # Option B: Connecting to LM Studio
  - model_name: lmstudio-model
    litellm_params:
      model: openai/local-model # litellm uses 'openai/' prefix for generic compatible endpoints
      api_base: "http://localhost:1234/v1" # Default LM Studio URL
      api_key: "any-string" # LM Studio doesn't strictly enforce keys usually

  # Option C: External OpenAI (for comparison/fallback)
  - model_name: gpt-3.5-turbo
    litellm_params:
      model: gpt-3.5-turbo
      api_key: os.environ/OPENAI_API_KEY
```

### Running LiteLLM Proxy
Run the proxy server. This will standardize everything to a local URL (usually `http://0.0.0.0:4000`).

```bash
litellm --config litellm_config.yaml
```
Output should show: `Running on http://0.0.0.0:4000`.

---

## 3. Configure Zibaldone

Now point Zibaldone to the LiteLLM proxy. Zibaldone uses the `LLM_MODEL` environment variable (defaults to `gpt-3.5-turbo`) and standard OpenAI env vars.

### Environment Variables
You can set these in your shell or a `.env` file for the backend.

**Common Setup (Connecting to LiteLLM Proxy):**

```bash
# Point to your LiteLLM Proxy address
export OPENAI_API_BASE="http://0.0.0.0:4000"
export OPENAI_API_KEY="sk-1234" # value doesn't matter for local, but must be non-empty

# Select the model name you defined in litellm_config.yaml
export LLM_MODEL="ollama-llama3" 
# OR
export LLM_MODEL="lmstudio-model"
```

### Running Zibaldone
With those variables passed to the backend:

```bash
cd backend
uvicorn app.main:app --reload
```

---

## 4. Deployment Scenarios

### Scenario A: Everything on One Machine (Localhost)
*   **Ollama/LM Studio**: binds to `localhost`.
*   **LiteLLM**: binds to `localhost` or `0.0.0.0`.
*   **Zibaldone**: Connects via `http://localhost:4000`.
*   **Configuration**: Use the defaults above.

### Scenario B: Distributed (Local Network)
*   **Machine 1 (GPU Server)**: Runs Ollama/LM Studio + LiteLLM.
    *   **Ollama**: `OLLAMA_HOST=0.0.0.0` (to listen on all interfaces).
    *   **LiteLLM**: Run with `--host 0.0.0.0`. 
        *   Command: `litellm --config litellm_config.yaml --host 0.0.0.0`
    *   *Firewall*: Ensure port `4000` (LiteLLM) is open.
*   **Machine 2 (App Server)**: Runs Zibaldone.
    *   **Configuration**:
        ```bash
        export OPENAI_API_BASE="http://<MACHINE_1_IP>:4000"
        export OPENAI_API_KEY="sk-any"
        export LLM_MODEL="ollama-llama3"
        ```

### Troubleshooting
*   **"Importing binding name..." error**: This was a frontend issue, unrelated to LLM.
*   **Connection Refused**: Check if LiteLLM is actually running on port 4000. Check `curl http://localhost:4000/models` to verify.
*   **Model Not Found**: Ensure `LLM_MODEL` matches exactly the `model_name` in `litellm_config.yaml`.

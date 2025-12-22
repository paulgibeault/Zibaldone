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
      model: openai/gpt-oss-20b # Your specific loaded model
      api_base: "http://localhost:1234" 
      api_key: "any-string"

  # Option C: External OpenAI (for comparison/fallback)
  - model_name: gpt-3.5-turbo
    litellm_params:
      model: gpt-3.5-turbo
      api_key: os.environ/OPENAI_API_KEY
```

### Running LiteLLM Proxy
Run the proxy server. This will standardize everything to a local URL. Note the `--host 0.0.0.0` flag, which is **required** for your remote devices to connect.

```bash
litellm --config litellm_config.yaml --host 0.0.0.0
```
Output should show: `Running on http://0.0.0.0:4000`.

---

## 3. Configure Zibaldone

Now point Zibaldone to the LiteLLM proxy. Zibaldone uses the `LLM_MODEL` environment variable (defaults to `gpt-3.5-turbo`) and standard OpenAI env vars.

### Environment Variables
You can set these in your shell or a `.env` file for the backend.

**Mac Studio Host Setup:**

```bash
# Point to your LiteLLM Proxy address (localhost is fine since Zibaldone is on the same Mac)
export OPENAI_API_BASE="http://localhost:4000"
export OPENAI_API_KEY="sk-1234" # value doesn't matter for local, but must be non-empty

# Select the model name you defined in litellm_config.yaml
export LLM_MODEL="lmstudio-model"
```

### Running Zibaldone
With those variables passed to the backend, run the server allowing external connections (`--host 0.0.0.0`):

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0
```

---

## 4. Deployment Scenarios

### Mac Studio Host (M4 Pro) with Remote Access

> [!CAUTION]
> **Security Warning**: By running with `--host 0.0.0.0`, you are exposing these services to every device on your network (and potentially the internet if you have port forwarding). Zibaldone currently **DOES NOT** have built-in authentication.

**Recommended Secure Setup:**
Do **NOT** open ports 8000 (Zibaldone) or 4000 (LiteLLM) on your router firewall. Instead, use a VPN.

#### 1. SSH Port Forwarding (The Simplest OSS Way)
If you can SSH into your Mac Studio, you can securely tunnel the Zibaldone web interface to your local device.

**On your Laptop/Mac:**
Run this command to forward your Mac Studio's port 8000 to your local machine:
```bash
ssh -L 8000:localhost:8000 user@<mac-studio-ip>
```
*   Now open `http://localhost:8000` on your laptop.
*   Traffic is fully encrypted via SSH.

**On Android (Termux) or iOS (a-Shell/iSH):**
You can run the same command to tunnel from a mobile device.

#### 2. WireGuard (The Robust VPN Way)
[WireGuard](https://www.wireguard.com/) is a modern, high-performance, open-source VPN protocol.
1.  **Server**: Install WireGuard on your Mac Studio (using `brew install wireguard-tools` or a UI like the open-source [WgCms](https://github.com/Place1/wg-access-server) for easier management).
2.  **Client**: Install the WireGuard app on your phone/laptop.
3.  **Connect**: Once connected, you can access the Mac Studio's local IP securely as if you were on the same Wi-Fi.

#### 3. Headscale (Self-Hosted Mesh VPN)
If you like the "mesh networking" features of Tailscale but want a fully open-source, self-hosted backend, use [Headscale](https://github.com/juanfont/headscale).
*   It implements the Tailscale control protocol, allowing you to use standard clients without relying on their proprietary servers.

#### 4. Local Network Only (Home Wi-Fi)
If you trust everyone on your Wi-Fi:
*   **Mac Studio**:
    *   **LM Studio**: Ensure "Server Port" is `1234` and it's listening.
    *   **LiteLLM**: `litellm --config litellm_config.yaml --host 0.0.0.0`
    *   **Zibaldone**: `uvicorn app.main:app --reload --host 0.0.0.0`
*   **Clients (Phone/Laptop)**:
    *   Find your Mac's IP address (System Settings -> Wi-Fi -> Details, e.g., `192.168.1.50`).
    *   Open `http://192.168.1.50:8000` in the browser.

### Troubleshooting
*   **"Importing binding name..." error**: This was a frontend issue, unrelated to LLM.
*   **Connection Refused**: Check if LiteLLM is actually running on port 4000. Check `curl http://localhost:4000/models` to verify.
*   **Model Not Found**: Ensure `LLM_MODEL` matches exactly the `model_name` in `litellm_config.yaml`.
*   **Cannot connect from phone**: Ensure your firewall is allowing incoming connections on ports 8000 and 4000, or use Tailscale (which bypasses this issue).

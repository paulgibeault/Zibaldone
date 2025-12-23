# Setting up LM Studio for Zibaldone

Zibaldone requires a local LLM server to process files. We recommend **LM Studio** (v0.3.x+) for its ease of use and compatibility.

## 1. Start the Local Server

1.  Open **LM Studio**.
2.  Click on the **Developer (AI Server)** icon in the left sidebar.
3.  Load a model if you haven't already (Select a model from the top dropdown).
4.  Click the green **Start Server** button.

## 2. Enable Network Accessibility (Required for Docker)

If you are running Zibaldone via **Docker/Colima**, you must allow the container to reach the host:

1.  In the **Local Server** settings within LM Studio:
2.  Toggle **Serve on Local Network** to **ON**.
    - *Note: This binds the server to `0.0.0.0`, allowing external connections.*
3.  Ensure **CORS (Cross-Origin Resource Sharing)** is enabled.
4.  Default Port: `1234`.

## 3. Identify the URL

- **Native (Local)**: `http://localhost:1234`
- **Docker/Colima**: `http://host.docker.internal:1234` (The setup script handles this for you).

## 4. Key Benefits of Network Access

- **Docker Compatibility**: Essential for containers to "talk" to the Mac host.
- **Privacy**: All processing stays on your local hardware.
- **Offload Compute**: Host the model on an M-series Mac while interacting from any device on your Wi-Fi.

## Troubleshooting

- **Connection Refused (Native)**: 
  ```bash
  curl http://localhost:1234/v1/models
  ```
- **Connection Refused (Docker)**: 
  Ensure **Serve on Local Network** is ON. If the server is only listening on `127.0.0.1`, Docker containers cannot reach it.
- **Port Conflicts**: If port `1234` is busy, change the port in LM Studio and re-run `./setup`.

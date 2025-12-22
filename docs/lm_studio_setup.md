# Setting up LM Studio for Zibaldone

Zibaldone requires a local LLM server to process files. We recommend **LM Studio** for its ease of use and compatibility.

## 1. Start the Local Server

1.  Open **LM Studio**.
2.  Click on the **Local Server** icon in the left sidebar. It looks like a double-headed arrow `<->` or a network icon.
3.  Load a model if you haven't already (Select a model from the top dropdown).
4.  Click the green **Start Server** button.

## 2. Identify the Port

Once the server is running, look for the **Port** field in the server configuration panel.
- **Default Port**: `1234`
- **URL**: `http://localhost:1234`

## 3. Configure Zibaldone

If your port is `1234`, you are all set! Zibaldone expects this default.

### Using a Different Port

If you need to use a different port (e.g., `8080`), you must update Zibaldone's configuration:

1.  Open `litellm_config.yaml` in the project root.
2.  Find the `api_base` setting under `zibaldone-model`:
    ```yaml
    - model_name: zibaldone-model
      litellm_params:
        model: openai/your-model-name
        api_base: "http://localhost:8080/v1"  <-- Update this port
    ```
3.  Restart Zibaldone by running `./go` again.

## Troubleshooting

- **Server Status**: Ensure the server logs in LM Studio show "Server started" and are not displaying errors.
- **Connection Refused**: Use `curl` to test the connection:
  ```bash
  curl http://localhost:1234/v1/models
  ```
  You should receive a JSON list of models.

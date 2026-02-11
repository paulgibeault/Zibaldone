
import pytest
import os
import json
import tempfile
from pathlib import Path
from backend.app.services.sandbox import MacDockerSandbox

@pytest.mark.asyncio
async def test_sandbox_execution():
    """
    Verifies that MacDockerSandbox can run a simple python script in a container.
    Requires Colima/Docker to be running.
    """
    sandbox = MacDockerSandbox()
    
    # 1. Create a dummy script
    script_content = """
import sys
import json

if __name__ == "__main__":
    # Print JSON to stdout
    print(json.dumps({"message": "Hello from Sandbox", "status": "success"}))
"""
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False, dir=os.getcwd()) as f:
        f.write(script_content)
        script_path = f.name
        
    try:
        # 2. Run in sandbox
        volumes = {
            script_path: {'bind': '/app/script.py', 'mode': 'ro'}
        }
        
        cmd = "python /app/script.py"
        
        # We need a valid image. 
        # Ensuring 'python:3.11-slim' is pulled might take time on first run.
        logs = await sandbox.run_container(
            image="python:3.11-slim",
            command=cmd,
            volumes=volumes
        )
        
        # 3. Verify output
        print(f"Container Logs: {logs}")
        data = json.loads(logs.strip().split('\n')[-1])
        
        assert data["status"] == "success"
        assert data["message"] == "Hello from Sandbox"
        
    finally:
        os.unlink(script_path)

if __name__ == "__main__":
    # Manual run helper
    import asyncio
    asyncio.run(test_sandbox_execution())

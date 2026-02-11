#!/usr/bin/env python3
import asyncio
from app.services.sandbox import MacDockerSandbox

async def test_llm_connectivity():
    sandbox = MacDockerSandbox()
    
    # Test HTTP connectivity to LiteLLM
    test_script = '''
import urllib.request
import json

try:
    req = urllib.request.Request(
        "http://host.docker.internal:4000/health",
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=5) as response:
        print("SUCCESS: HTTP connection works!")
        print(f"Status: {response.status}")
        print(f"Response: {response.read().decode('utf-8')}")
except Exception as e:
    print(f"FAILED: {e}")
'''
    
    try:
        logs = await sandbox.run_container(
            image="python:3.11-slim",
            command='python3 /test.py',
            files={'/test.py': test_script},
            extra_hosts={"host.docker.internal": "host-gateway"}
        )
        print("HTTP Test Result:")
        print(logs)
    except Exception as e:
        print(f"Container Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_llm_connectivity())

#!/usr/bin/env python3
import asyncio
from app.services.sandbox import MacDockerSandbox

async def test_direct_ip():
    sandbox = MacDockerSandbox()
    
    # Test HTTP connectivity to LiteLLM via direct IP
    test_script = '''
import urllib.request
import json

for url in ["http://192.168.5.2:4000/health", "http://10.0.0.109:4000/health"]:
    try:
        print(f"Testing {url}")
        req = urllib.request.Request(url, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=5) as response:
            print(f"  SUCCESS: Status {response.status}")
            print(f"  Response: {response.read().decode('utf-8')[:100]}")
    except Exception as e:
        print(f"  FAILED: {e}")
'''
    
    try:
        logs = await sandbox.run_container(
            image="python:3.11-slim",
            command='python3 /test.py',
            files={'/test.py': test_script},
            extra_hosts={"host.docker.internal": "host-gateway"}
        )
        print(logs)
    except Exception as e:
        print(f"Container Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_direct_ip())

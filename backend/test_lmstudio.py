#!/usr/bin/env python3
import asyncio
from app.services.sandbox import MacDockerSandbox

async def test_lmstudio():
    sandbox = MacDockerSandbox()
    
    test_script = '''
import urllib.request
import json

url = "http://10.0.0.52:1234/v1/models"
try:
    print(f"Testing {url}")
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=10) as response:
        print(f"SUCCESS: Status {response.status}")
        data = response.read().decode('utf-8')
        print(f"Response: {data[:200]}")
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
        print(logs)
    except Exception as e:
        print(f"Container Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_lmstudio())

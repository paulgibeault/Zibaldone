#!/usr/bin/env python3
import asyncio
from app.services.sandbox import MacDockerSandbox

async def test_dns():
    sandbox = MacDockerSandbox()
    
    # Test DNS resolution
    try:
        logs = await sandbox.run_container(
            image="python:3.11-slim",
            command='sh -c "getent hosts host.docker.internal || echo \'FAILED to resolve\'"',
            extra_hosts={"host.docker.internal": "host-gateway"}
        )
        print("DNS Test Result:")
        print(logs)
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_dns())

import docker
import os
import tarfile
import tempfile
import logging
from pathlib import Path
from typing import Dict, Optional, Any, Union

logger = logging.getLogger(__name__)

class MacDockerSandbox:
    def __init__(self):
        self.client = self._get_docker_client()

    def _get_docker_client(self) -> docker.DockerClient:
        """
        Detects and returns a Docker client, preferring Colima on macOS.
        """
        # 1. Check for DOCKER_HOST env var
        if os.environ.get("DOCKER_HOST"):
            logger.info(f"Using DOCKER_HOST: {os.environ['DOCKER_HOST']}")
            return docker.from_env()

        # 2. Check for Colima socket
        home = Path.home()
        colima_socket = home / ".colima" / "default" / "docker.sock"
        
        if colima_socket.exists():
            socket_path = f"unix://{colima_socket}"
            logger.info(f"Detected Colima socket at {socket_path}")
            return docker.DockerClient(base_url=socket_path)

        # 3. Fallback to standard Docker socket (Docker Desktop or default Linux)
        logger.info("Falling back to default Docker environment")
        return docker.from_env()

    def _create_tar_stream(self, file_map: Dict[str, Union[str, bytes]]) -> bytes:
        import io
        import tarfile
        import time
        
        file_obj = io.BytesIO()
        with tarfile.open(fileobj=file_obj, mode='w') as tar:
            for path, content in file_map.items():
                # path should be relative or absolute? put_archive expects path inside container relative to 'path' arg
                # We will put everything into / (or working_dir)
                # Ensure path is relative to the destination root
                tar_path = path.lstrip('/')
                
                info = tarfile.TarInfo(name=tar_path)
                
                if isinstance(content, str):
                    content_bytes = content.encode('utf-8')
                else:
                    content_bytes = content
                    
                info.size = len(content_bytes)
                info.mtime = time.time()
                tar.addfile(info, io.BytesIO(content_bytes))
        return file_obj.getvalue()

    async def run_container(
        self, 
        image: str, 
        command: str, 
        setup_script: Optional[str] = None,
        env_vars: Dict[str, str] = {},
        volumes: Dict[str, Dict[str, str]] = {},
        files: Dict[str, Union[str, bytes]] = {}, # path inside container -> content (str or bytes)
        working_dir: str = "/app",
        extra_hosts: Optional[Dict[str, str]] = None
    ) -> str:
        """
        Runs a command in a Docker container and returns the output logs.
        Supports injecting files via 'files' dict to avoid volume mount issues in sibling containers.
        """
        container = None
        try:
            logger.info(f"Starting container with image {image}")
            
            # 1. Create Container (Stopped)
            container = self.client.containers.create(
                image,
                command=command,
                environment=env_vars,
                volumes=volumes, # Keep volumes if user really wants valid host bind mounts
                working_dir=working_dir,
                network_mode="bridge",
                mem_limit="512m",
                extra_hosts=extra_hosts if extra_hosts else {},
                # tty=True, # Maybe?
            )
            
            # 2. Inject Files
            if files:
                tar_bytes = self._create_tar_stream(files)
                # Put archive into root (so /app/foo goes to /app/foo)
                # We assume paths in 'files' are absolute container paths
                container.put_archive(path="/", data=tar_bytes)
            
            # 3. Start
            container.start()
            
            # 4. Wait
            exit_code = container.wait()
            logs = container.logs().decode("utf-8")
            
            if exit_code['StatusCode'] != 0:
                raise Exception(f"Container exited with code {exit_code['StatusCode']}:\n{logs}")
                
            return logs
            
        except Exception as e:
            logger.error(f"Sandbox execution failed: {e}")
            raise
        finally:
            if container:
                try:
                    container.remove(force=True)
                except Exception as e:
                    logger.warning(f"Failed to remove container: {e}")

    def create_bundle(self, code: str) -> str:
        """
        Deprecated: In-memory injection preferred.
        """
        return ""

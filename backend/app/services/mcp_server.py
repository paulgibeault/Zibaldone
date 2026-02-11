
import os
import glob
import logging
import asyncio
import json
import tempfile
from pathlib import Path
from fastmcp import FastMCP, Context
from typing import Dict, Any

from app.services.sandbox import MacDockerSandbox
from app.config import settings

logger = logging.getLogger(__name__)

# Initialize MCP Server
mcp = FastMCP("Zibaldone Skills")
sandbox = MacDockerSandbox()

# Resolve User Skills Directory
USER_SKILLS_DIR = settings.USER_SKILLS_DIR
if not USER_SKILLS_DIR:
    USER_SKILLS_DIR = os.path.expanduser("~/Documents/mcp-skills/library")

# Internal Skills Directory
INTERNAL_SKILLS_DIR = Path(__file__).resolve().parent.parent.parent / "skills"

@mcp.tool()
async def list_skills() -> Dict[str, str]:
    """
    List all available skills (internal and user).
    Returns a dictionary of {skill_name: description}.
    """
    skills = {}
    
    # User Skills
    if os.path.exists(USER_SKILLS_DIR):
        for script_path in glob.glob(os.path.join(USER_SKILLS_DIR, "*.py")):
            name = Path(script_path).stem
            if name.startswith("_"): continue
            skills[name] = "User Skill"
            
    # Internal Skills
    if INTERNAL_SKILLS_DIR.exists():
         for d in INTERNAL_SKILLS_DIR.iterdir():
             if d.is_dir() and (d / "skill.py").exists():
                 skills[d.name] = "Internal Skill"
                 
    return skills

async def run_skill_in_sandbox(name: str, parameters: Dict[str, Any] = {}) -> str:
    """
    Core logic to execute a skill in the sandbox.
    Returns the raw logs (stdout/stderr).
    """
    logger.info(f"Run Skill in Sandbox: {name}")
    
    # 1. Locate Skill Script
    script_path = None
    skill_cwd = "/app"
    
    # Check User Skills
    user_skill_path = os.path.join(USER_SKILLS_DIR, f"{name}.py")
    if os.path.exists(user_skill_path):
        script_path = user_skill_path
        skill_cwd = "/skills" # arbitrary
    
    # Check Internal Skills
    if not script_path and INTERNAL_SKILLS_DIR.exists():
        internal_path = INTERNAL_SKILLS_DIR / name / "skill.py"
        if internal_path.exists():
            script_path = str(internal_path)
            skill_cwd = str(INTERNAL_SKILLS_DIR / name) 
            
    if not script_path:
        return json.dumps({"status": "error", "message": f"Skill '{name}' not found."})

    # 2. Prepare Sandbox Execution
    try:
        # Read Skill Script
        try:
            with open(script_path, 'r') as f:
                script_content = f.read()
        except Exception as e:
            return json.dumps({"status": "error", "message": f"Failed to read skill script: {e}"})

        # Prepare Input JSON
        input_content = json.dumps(parameters)
        
        # Files to inject
        files_to_inject = {
            '/app/skill.py': script_content,
            '/input.json': input_content
        }

        # Inject Content File if available
        container_content_path = ""
        storage_path = parameters.get("storage_path")
        original_filename = parameters.get("original_filename")

        if storage_path:
            try:
                from app.services.storage import get_storage
                storage = get_storage()
                # Get Content (Bytes)
                content_bytes = await storage.get_content(storage_path)
                
                # Determine container path for content
                filename = os.path.basename(original_filename) if original_filename else "content"
                # Simple sanitization
                filename = "".join([c for c in filename if c.isalpha() or c.isdigit() or c in "._-"])
                container_content_path = f"/data/{filename}"
                
                # Add to injection map
                files_to_inject[container_content_path] = content_bytes
                
            except Exception as e:
                logger.error(f"Failed to fetch content for injection: {e}")
                # We continue without content, skill might handle it or fail gracefully
        
        # No volumes needed for code/input
        volumes = {}
        
        # Determine command - standardize on piping stdin AND passing file path arg
        
        # Construct the internal command string
        # If we have a file, pass it as argument: `python /app/skill.py /data/filename`
        # If not, just `python /app/skill.py`
        python_cmd = f"python /app/skill.py {container_content_path}".strip()
        
        full_cmd = f"cat /input.json | {python_cmd}"
        
        cmd = f"sh -c '{full_cmd}'"
        
        # Execute
        logs = await sandbox.run_container(
            image="python:3.11-slim",
            command=cmd,
            volumes=volumes,
            files=files_to_inject,
            env_vars={
                "LITELLM_URL": settings.LITELLM_URL,
                "LITELLM_API_KEY": settings.LITELLM_API_KEY
            },
            working_dir="/app",
            extra_hosts={"host.docker.internal": "host-gateway"}
        )
        
        return logs
        
    except Exception as e:
        logger.error(f"Sandbox Error: {e}")
        return json.dumps({"status": "error", "message": str(e)})
        
    finally:
        pass # No temp files to cleanup

@mcp.tool()
async def execute_skill(name: str, parameters: Dict[str, Any] = {}) -> str:
    """
    Execute a skill by name within the sandbox.
    Args:
        name: The name of the skill to run.
        parameters: A dictionary of inputs for the skill.
    """
    return await run_skill_in_sandbox(name, parameters)

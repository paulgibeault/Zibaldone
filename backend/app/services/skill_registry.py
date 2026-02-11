import os
import json
import yaml
import importlib.util
from typing import Dict, List, Optional, Any, TYPE_CHECKING
from pydantic import BaseModel, Field
from pathlib import Path
import logging

if TYPE_CHECKING:
    from app.services.skill_sdk import SkillContext, SkillResult

logger = logging.getLogger(__name__)

# Define skills directory relative to this file
# backend/app/services/skill_registry.py -> backend/skills
SKILLS_DIR = Path(__file__).resolve().parent.parent.parent / "skills"

class SkillTrigger(BaseModel):
    event: str
    priority: int = 10

class SkillParameter(BaseModel):
    type: str
    default: Any = None
    description: str = ""

class SkillConfig(BaseModel):
    name: str 
    description: str
    version: str = "0.0.1"
    timeout: Optional[int] = None
    triggers: List[SkillTrigger] = Field(default_factory=list)
    parameters: Dict[str, SkillParameter] = Field(default_factory=dict)
    path: Optional[Path] = None

    class Config:
        arbitrary_types_allowed = True

class SkillRegistry:
    def __init__(self):
        self.skills: Dict[str, SkillConfig] = {}
        self.trigger_map: Dict[str, List[str]] = {} 

    def load_skills(self):
        """Scans the skills directory and loads proper configurations."""
        self.skills = {}
        self.trigger_map = {}
        
        if not SKILLS_DIR.exists():
            logger.warning(f"Skills directory not found: {SKILLS_DIR}")
            return

        logger.info(f"Scanning for skills in {SKILLS_DIR}")
        for skill_path in SKILLS_DIR.iterdir():
            if skill_path.is_dir():
                config_file = skill_path / "skill.yaml"
                if config_file.exists():
                    try:
                        with open(config_file, 'r') as f:
                            config_data = yaml.safe_load(f)
                        
                        config = SkillConfig(**config_data)
                        config.path = skill_path
                        
                        self.skills[config.name] = config
                        
                        for trigger in config.triggers:
                            if trigger.event not in self.trigger_map:
                                self.trigger_map[trigger.event] = []
                            self.trigger_map[trigger.event].append(config.name)
                            
                        logger.info(f"Loaded skill: {config.name}")
                    except Exception as e:
                        logger.error(f"Failed to load skill at {skill_path}: {e}")

    def get_skill(self, name: str) -> Optional[SkillConfig]:
        return self.skills.get(name)

    def get_skills_for_trigger(self, event: str) -> List[SkillConfig]:
        skill_names = self.trigger_map.get(event, [])
        configs = [self.skills[n] for n in skill_names if n in self.skills]
        
        # Sort by priority (higher first)
        def get_priority(cfg: SkillConfig, evt: str):
            for t in cfg.triggers:
                if t.event == evt:
                    return t.priority
            return 0
            
        configs.sort(key=lambda x: get_priority(x, event), reverse=True)
        return configs

    async def execute_skill(self, skill_name: str, context: 'SkillContext') -> 'SkillResult':
        """
        Executes the skill via the MCP server (which runs it in the sandbox).
        """
        config = self.skills.get(skill_name)
        if not config:
            raise ValueError(f"Skill {skill_name} not found")
        
        # Determine parameters to send to MCP
        # SkillContext contains everything needed.
        # We pass it as a dict.
        parameters = json.loads(context.to_json())
        
        try:
            from app.services.mcp_server import run_skill_in_sandbox
            from app.services.skill_sdk import SkillResult

            # Execute via MCP
            # This returns the logs/stdout from the container
            # We must pass the directory name, not the display name, so MCP can find the file.
            skill_dir_name = config.path.name if config.path else skill_name.replace(" ", "_").lower()
            logs = await run_skill_in_sandbox(skill_dir_name, parameters)
            
            # Parse Result
            # expecting JSON on the last line
            lines = logs.strip().split('\n')
            last_line = lines[-1] if lines else "{}"
            
            try:
                result_data = json.loads(last_line)
                return SkillResult.from_json(result_data)
            except json.JSONDecodeError:
                # If valid JSON not found, treat as failure but return logs for debugging
                logger.error(f"Skill {skill_name} did not return valid JSON. Logs provided in message.")
                return SkillResult(
                    status="failure",
                    message=f"Skill execution failed to produce valid JSON output.\nLogs:\n{logs}"
                )
                
        except Exception as e:
            logger.error(f"Error executing skill {skill_name} via MCP: {e}")
            raise

# Global instance
skill_registry = SkillRegistry()

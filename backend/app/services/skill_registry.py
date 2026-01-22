import os
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
        """Dynamically loads and executes the skill's run function."""
        config = self.skills.get(skill_name)
        if not config:
            raise ValueError(f"Skill {skill_name} not found")
        
        script_path = config.path / "skill.py"
        if not script_path.exists():
             raise FileNotFoundError(f"skill.py not found for {skill_name}")

        try:
            # Dynamic import
            spec = importlib.util.spec_from_file_location(f"skills.{skill_name.replace(' ', '_')}", script_path)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            
            if not hasattr(module, 'run'):
                 raise AttributeError(f"Skill {skill_name} missing 'run' function")
                 
            return await module.run(context)
        except Exception as e:
            logger.error(f"Error executing skill {skill_name}: {e}")
            raise

# Global instance
skill_registry = SkillRegistry()

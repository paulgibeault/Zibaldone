
import json
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

@dataclass
class SkillResult:
    """
    Standardized return value for a Skill execution.
    """
    status: str = "success"  # success, failure, skipped, error
    message: str = ""
    metadata_patch: Dict[str, Any] = field(default_factory=dict)
    new_version_created: bool = False
    new_content: Optional[str] = None # Base64 or text?
    events_to_emit: List[str] = field(default_factory=list)
    tags_to_add: List[str] = field(default_factory=list)
    
    @classmethod
    def from_json(cls, data: Dict[str, Any]):
        return cls(**data)
        
    def to_json(self) -> str:
        return json.dumps(self.__dict__)

    def json(self) -> str:
        return self.to_json()

@dataclass
class SkillContext:
    """
    Serializable context passed to a Skill.
    Contains all necessary data for the skill to run without DB access.
    """
    item_id: str
    original_filename: str
    storage_path: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    params: Dict[str, Any] = field(default_factory=dict)
    
    # Pre-fetched data from DB that skill might need
    existing_tags: List[str] = field(default_factory=list)
    
    def to_json(self) -> str:
        return json.dumps(self.__dict__)
        
    @classmethod
    def from_json(cls, json_str: str):
        data = json.loads(json_str)
        return cls(**data)

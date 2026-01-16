import logging
from typing import Any, Dict, List, Optional, Union
from uuid import UUID
from pydantic import BaseModel, Field
from sqlmodel import Session
from app.models import ContentItem, ProcessingTask
from app.services.storage import get_storage

logger = logging.getLogger(__name__)

class SkillResult(BaseModel):
    """
    Standardized return value for a Skill execution.
    """
    status: str = "success"  # success, failure, skipped
    message: str = ""
    metadata_patch: Dict[str, Any] = Field(default_factory=dict)
    new_content: Optional[bytes] = None
    new_file_extension: Optional[str] = None # If content type changes
    new_version_created: bool = False
    events_to_emit: List[str] = Field(default_factory=list)
    tags_to_add: List[str] = Field(default_factory=list)
    provenance_details: Dict[str, Any] = Field(default_factory=dict)

class SkillContext:
    """
    Provides context and helper methods for a running Skill.
    """
    def __init__(self, session: Session, task: ProcessingTask, item: ContentItem):
        self.session = session
        self.task = task
        self.item = item
        self.params = task.parameters or {}
        self.logger = logger
        self.storage = get_storage()

    async def read_file_content(self, as_text: bool = True) -> Union[str, bytes, None]:
        """
        Reads the content of the current file version.
        """
        try:
            content_bytes = await self.storage.get_content(self.item.storage_path)
            if as_text:
                return content_bytes.decode('utf-8', errors='ignore')
            return content_bytes
        except Exception as e:
            self.logger.error(f"Error reading file content for item {self.item.id}: {e}")
            raise

    def get_metadata(self) -> Dict[str, Any]:
        """Returns a copy of the current item metadata."""
        return self.item.item_metadata.copy() if self.item.item_metadata else {}

    def update_metadata(self, metadata: Dict[str, Any], message: str = "Metadata updated") -> SkillResult:
        """Helper to return a metadata-update result."""
        return SkillResult(
            status="success",
            message=message,
            metadata_patch=metadata
        )

    def create_result(self, metadata: Dict[str, Any] = None, events: List[str] = None, tags: List[str] = None, message: str = "Success") -> SkillResult:
        """
        Generic helper to create a success result with metadata and events.
        """
        return SkillResult(
            status="success",
            message=message,
            metadata_patch=metadata or {},
            events_to_emit=events or [],
            tags_to_add=tags or []
        )
        
    def no_change(self, message: str = "No changes needed") -> SkillResult:
        """Helper to return a no-op result."""
        return SkillResult(status="success", message=message)

    def fail(self, message: str) -> SkillResult:
        """Helper to return a failure result."""
        return SkillResult(status="failure", message=message)

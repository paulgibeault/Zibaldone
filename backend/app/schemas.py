import uuid
from datetime import datetime
from typing import Optional, List
from sqlmodel import SQLModel
from app.models import ContentStatus, TaskStatus

# --- Tag Schemas ---
class UserRead(SQLModel):
    id: uuid.UUID
    display_name: str
    is_admin: bool
    profile_color: str

class UserUpdate(SQLModel):
    display_name: Optional[str] = None
    profile_color: Optional[str] = None

class TagBase(SQLModel):
    name: str
    color: str
    is_autocreated: bool = False
    is_approved: bool = True

class TagCreate(TagBase):
    pass

class TagUpdate(SQLModel):
    name: Optional[str] = None
    color: Optional[str] = None

class TagRead(TagBase):
    id: uuid.UUID
    is_autocreated: bool
    is_approved: bool

# --- ProcessingTask Schemas ---
class ProcessingTaskRead(SQLModel):
    id: uuid.UUID
    item_id: uuid.UUID
    name: str
    status: TaskStatus
    message: Optional[str]
    start_time: datetime
    end_time: Optional[datetime]
    result_json: Optional[str] = None

# --- ContentItem Schemas ---
class ContentItemBase(SQLModel):
    original_filename: str
    status: ContentStatus
    storage_path: str
    metadata_json: Optional[str] = "{}"
    version: int = 1
    content_type: Optional[str] = None
    checksum: Optional[str] = None

class ContentItemRead(SQLModel):
    id: uuid.UUID
    status: ContentStatus
    original_filename: str
    storage_path: str
    created_at: datetime
    metadata_json: Optional[str]
    download_url: Optional[str] = None
    tags: List[TagRead] = []
    tasks: List[ProcessingTaskRead] = []

class ContentItemUpdate(SQLModel):
    status: Optional[ContentStatus] = None
    metadata_json: Optional[str] = None

class SearchResponse(SQLModel):
    tags: List[TagRead]
    items: List[ContentItemRead]

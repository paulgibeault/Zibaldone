import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlmodel import SQLModel
from app.models import ContentStatus, TaskStatus, NotebookViewMode

# --- Tag Schemas ---
class UserRead(SQLModel):
    id: uuid.UUID
    display_name: str
    is_admin: bool
    profile_color: str

class SessionRead(SQLModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    created_at: datetime
    last_used_at: datetime
    is_active: bool

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

# --- ContentItem Schemas (Basic) ---
class ContentItemBasic(SQLModel):
    id: uuid.UUID
    original_filename: str
    item_metadata: Dict[str, Any] = {}

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
    
    item: Optional[ContentItemBasic] = None

# --- Notebook Schemas ---
class NotebookBase(SQLModel):
    title: str
    description: Optional[str] = None
    view_mode: NotebookViewMode = NotebookViewMode.GRID

class NotebookCreate(NotebookBase):
    pass

class NotebookUpdate(SQLModel):
    title: Optional[str] = None
    description: Optional[str] = None
    view_mode: Optional[NotebookViewMode] = None

class NotebookRead(NotebookBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

class NotebookReadWithItems(NotebookRead):
    items: List["ContentItemRead"] = []

class NotebookAddItems(SQLModel):
    item_ids: List[uuid.UUID]

# --- Notebook Chat Schemas ---
class ChatMessage(SQLModel):
    role: str
    content: str
    
class NotebookChatRequest(SQLModel):
    message: str
    context_item_ids: List[uuid.UUID]
    chat_history: List[ChatMessage] = []

class NotebookChatResponse(SQLModel):
    response: str
    suggested_title: Optional[str] = None
    debug_info: Optional[Dict[str, Any]] = None

# --- NotebookTask Schemas ---
class NotebookTaskBase(SQLModel):
    name: str
    definition_json: Dict[str, Any] = {}
    trigger_config_json: Dict[str, Any] = {}
    is_active: bool = True

class NotebookTaskCreate(NotebookTaskBase):
    notebook_id: uuid.UUID

class NotebookTaskUpdate(SQLModel):
    name: Optional[str] = None
    definition_json: Optional[Dict[str, Any]] = None
    trigger_config_json: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None

class NotebookTaskRead(NotebookTaskBase):
    id: uuid.UUID
    notebook_id: uuid.UUID
    last_run_at: Optional[datetime] = None

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
    version: int
    client_file_path: Optional[str] = None
    storage_path: str
    created_at: datetime
    item_metadata: Dict[str, Any] = {}
    download_url: Optional[str] = None
    tags: List[TagRead] = []
    tasks: List[ProcessingTaskRead] = []

class ContentItemUpdate(SQLModel):
    status: Optional[ContentStatus] = None
    metadata_json: Optional[str] = None

class SearchResponse(SQLModel):
    tags: List[TagRead]
    items: List[ContentItemRead]

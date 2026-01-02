from typing import Optional
from sqlmodel import Field, SQLModel, create_engine, Session, Relationship
from datetime import datetime, timezone
import uuid
from enum import Enum

class ContentStatus(str, Enum):
    QUEUED = "QUEUED"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"

class ContentItemTagLink(SQLModel, table=True):
    item_id: uuid.UUID = Field(foreign_key="contentitem.id", primary_key=True)
    tag_id: uuid.UUID = Field(foreign_key="tag.id", primary_key=True)

class Tag(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(index=True, unique=True)
    color: str = Field(default="#888888")
    is_autocreated: bool = Field(default=False)
    is_approved: bool = Field(default=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    items: list["ContentItem"] = Relationship(back_populates="tags", link_model=ContentItemTagLink)

class TaskStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"

class ProcessingTask(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    item_id: uuid.UUID = Field(foreign_key="contentitem.id", index=True)
    name: str # e.g., "Metadata Extraction"
    status: TaskStatus = Field(default=TaskStatus.PENDING)
    message: Optional[str] = None
    start_time: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    end_time: Optional[datetime] = None
    result_json: Optional[str] = None

    item: "ContentItem" = Relationship(back_populates="tasks")

class ContentItem(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    status: ContentStatus = Field(default=ContentStatus.QUEUED)
    original_filename: str = Field(index=True)
    version: int = Field(default=1, index=True)
    content_type: Optional[str] = Field(default=None, index=True)
    checksum: Optional[str] = Field(default=None, index=True) # SHA-256 for duplication detection
    storage_path: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)
    metadata_json: Optional[str] = Field(default="{}") # Storing simple JSON as string for SQLite simplicity initially
    
    tags: list[Tag] = Relationship(back_populates="items", link_model=ContentItemTagLink)
    tasks: list[ProcessingTask] = Relationship(back_populates="item", sa_relationship_kwargs={"cascade": "all, delete-orphan"})

from pathlib import Path

# Robust path handling
BASE_DIR = Path(__file__).resolve().parent.parent # points to backend/
DATA_DIR = BASE_DIR.parent / "data" # points to zibaldone/data
DATA_DIR.mkdir(exist_ok=True) # Ensure data dir exists

sqlite_file_name = DATA_DIR / "database.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"

connect_args = {"check_same_thread": False}
engine = create_engine(sqlite_url, connect_args=connect_args)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session

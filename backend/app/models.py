from typing import Optional
from sqlmodel import Field, SQLModel, create_engine, Session
from datetime import datetime
import uuid
from enum import Enum

class ContentStatus(str, Enum):
    UNPROCESSED = "unprocessed"
    TAGGED = "tagged"
    INDEXED = "indexed"

class ContentItem(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    status: ContentStatus = Field(default=ContentStatus.UNPROCESSED)
    original_filename: str
    storage_path: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    metadata_json: Optional[str] = Field(default="{}") # Storing simple JSON as string for SQLite simplicity initially

sqlite_file_name = "../data/database.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"

connect_args = {"check_same_thread": False}
engine = create_engine(sqlite_url, connect_args=connect_args)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session

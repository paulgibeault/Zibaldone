from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, Response
from fastapi.responses import FileResponse, RedirectResponse
from typing import Optional, List
from datetime import datetime
from sqlmodel import Session, select, desc, SQLModel
from sqlalchemy.orm import selectinload
from app.models import get_session, ContentItem, ContentStatus, Tag, ContentItemTagLink
import aiofiles
import os
import uuid
import hashlib

from app.services.storage import get_storage
from app.services.event_broadcaster import broadcaster
import json

# --- Response Schemas ---
class TagRead(SQLModel):
    id: uuid.UUID
    name: str
    color: str

class ContentItemRead(SQLModel):
    id: uuid.UUID
    status: ContentStatus
    original_filename: str
    storage_path: str
    created_at: datetime
    metadata_json: Optional[str]
    download_url: Optional[str] = None
    tags: List[TagRead] = []
# ------------------------

router = APIRouter()

# Initialize storage
storage = get_storage()

def calculate_checksum(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()

def enrich_item(item: ContentItem) -> ContentItemRead:
    url = storage.get_download_url(item.storage_path)
    if not url:
        # Local file, point to our own download endpoint
        url = f"/api/items/{item.id}/download"
    
    # Map to ContentItemRead
    # We include tags by converting them to TagRead
    tags = [TagRead(id=t.id, name=t.name, color=t.color) for t in item.tags]
    
    return ContentItemRead(
        id=item.id,
        status=item.status,
        original_filename=item.original_filename,
        storage_path=item.storage_path,
        created_at=item.created_at,
        metadata_json=item.metadata_json,
        download_url=url,
        tags=tags
    )

def get_next_version(session: Session, filename: str) -> int:
    statement = select(ContentItem).where(ContentItem.original_filename == filename).order_by(desc(ContentItem.version))
    latest_item = session.exec(statement).first()
    if latest_item:
        return latest_item.version + 1
    return 1

@router.get("/upload/params")
async def get_upload_params(filename: str):
    params = await storage.get_upload_params(filename)
    return params

@router.post("/upload/finalize", response_model=ContentItemRead)
async def finalize_upload(
    original_filename: str = Form(...),
    storage_path: str = Form(...),
    metadata: str = Form("{}"),
    content_type: Optional[str] = Form(None),
    checksum: Optional[str] = Form(None),
    session: Session = Depends(get_session)
):
    # Determine next version
    version = get_next_version(session, original_filename)
    
    # Create DB record after direct S3 upload or local fallback
    content_item = ContentItem(
        original_filename=original_filename,
        storage_path=storage_path,
        status=ContentStatus.UNPROCESSED,
        metadata_json=metadata,
        version=version,
        content_type=content_type,
        checksum=checksum
    )
    session.add(content_item)
    session.commit()
    session.refresh(content_item)
    
    return enrich_item(content_item)

@router.post("/upload", response_model=ContentItemRead)
async def upload_content(
    file: UploadFile = File(...), 
    metadata: str = Form("{}"),
    session: Session = Depends(get_session)
):
    content = await file.read()
    checksum = calculate_checksum(content)
    
    # Optional: Check if file with same checksum already exists
    statement = select(ContentItem).where(ContentItem.checksum == checksum)
    existing_item = session.exec(statement).first()
    if existing_item:
        # If identical file exists, we could either return it or create a new version pointing to same path
        # For now, let's create a new version but reuse the same storage_path (optional/TBD)
        # To keep it simple and follow the plan's "Immutable Blobs" rule, we'll save it again for now
        pass
        
    storage_path = await storage.save(content, file.filename)
    version = get_next_version(session, file.filename)
        
    # Create DB record (legacy/fallback support)
    content_item = ContentItem(
        original_filename=file.filename,
        storage_path=storage_path,
        status=ContentStatus.UNPROCESSED,
        metadata_json=metadata,
        version=version,
        content_type=file.content_type,
        checksum=checksum
    )
    session.add(content_item)
    session.commit()
    session.refresh(content_item)
    
    return enrich_item(content_item)

@router.get("/items", response_model=List[ContentItemRead])
def read_items(
    filename: Optional[str] = None,
    content_type: Optional[str] = None,
    after: Optional[datetime] = None,
    show_all_versions: bool = False,
    session: Session = Depends(get_session)
):
    statement = select(ContentItem).options(selectinload(ContentItem.tags))
    
    if filename:
        statement = statement.where(ContentItem.original_filename == filename)
    if content_type:
        statement = statement.where(ContentItem.content_type == content_type)
    if after:
        statement = statement.where(ContentItem.created_at >= after)
        
    if not show_all_versions:
        # Show only the latest version of each filename using a correlated subquery
        from sqlalchemy.orm import aliased
        
        c2 = aliased(ContentItem)
        subquery = (
            select(1)
            .where(c2.original_filename == ContentItem.original_filename)
            .where(c2.version > ContentItem.version)
        )
        statement = statement.where(~subquery.exists())
    
    items = session.exec(statement).all()
    
    return [enrich_item(item) for item in items]

@router.get("/items/{item_id}/download")
async def download_item(item_id: uuid.UUID, session: Session = Depends(get_session)):
    item = session.get(ContentItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
        
    url = storage.get_download_url(item.storage_path)
    if url:
        return RedirectResponse(url=url)
        
    full_path = storage.get_path(item.storage_path)
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="File not found on disk")
        
    return FileResponse(full_path, filename=item.original_filename)

@router.post("/items/{item_id}/tags/{tag_id}", response_model=ContentItemRead)
async def add_tag_to_item(item_id: uuid.UUID, tag_id: uuid.UUID, session: Session = Depends(get_session)):
    item = session.exec(select(ContentItem).where(ContentItem.id == item_id).options(selectinload(ContentItem.tags))).first()
    tag = session.get(Tag, tag_id)
    if tag not in item.tags:
        item.tags.append(tag)
        session.add(item)
        session.commit()
        session.refresh(item)
        # Notify clients
        await broadcaster.broadcast(json.dumps({"type": "update", "item_id": str(item.id)}))
    return enrich_item(item)

@router.delete("/items/{item_id}/tags/{tag_id}", response_model=ContentItemRead)
async def remove_tag_from_item(item_id: uuid.UUID, tag_id: uuid.UUID, session: Session = Depends(get_session)):
    item = session.exec(select(ContentItem).where(ContentItem.id == item_id).options(selectinload(ContentItem.tags))).first()
    tag = session.get(Tag, tag_id)
    if not item or not tag:
        raise HTTPException(status_code=404, detail="Item or Tag not found")
    
    if tag in item.tags:
        item.tags.remove(tag)
        session.add(item)
        session.commit()
        session.refresh(item)
        # Notify clients
        await broadcaster.broadcast(json.dumps({"type": "update", "item_id": str(item.id)}))
    return enrich_item(item)

@router.delete("/items/{item_id}")
def delete_item(item_id: uuid.UUID, session: Session = Depends(get_session)):
    item = session.get(ContentItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Delete from storage
    storage.delete(item.storage_path)
    
    # Delete from DB
    session.delete(item)
    session.commit()
    
    return {"ok": True}

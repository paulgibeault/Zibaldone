from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from typing import Optional, List
from datetime import datetime
from sqlmodel import Session, select, desc
from app.models import get_session, ContentItem, ContentStatus
import aiofiles
import os
import uuid
import hashlib

from app.services.storage import get_storage

router = APIRouter()

# Initialize storage
storage = get_storage()

def calculate_checksum(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()

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

@router.post("/upload/finalize")
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
    
    return content_item

@router.post("/upload")
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
    
    return content_item

@router.get("/items")
def read_items(
    filename: Optional[str] = None,
    content_type: Optional[str] = None,
    after: Optional[datetime] = None,
    show_all_versions: bool = False,
    session: Session = Depends(get_session)
):
    statement = select(ContentItem)
    
    if filename:
        statement = statement.where(ContentItem.original_filename == filename)
    if content_type:
        statement = statement.where(ContentItem.content_type == content_type)
    if after:
        statement = statement.where(ContentItem.created_at >= after)
        
    if not show_all_versions:
        # Show only the latest version of each filename using a correlated subquery
        from sqlalchemy.orm import aliased
        from sqlmodel import func
        
        c2 = aliased(ContentItem)
        subquery = (
            select(1)
            .where(c2.original_filename == ContentItem.original_filename)
            .where(c2.version > ContentItem.version)
        )
        statement = statement.where(~subquery.exists())
    
    items = session.exec(statement).all()
    return items

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

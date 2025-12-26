from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlmodel import Session
from app.models import get_session, ContentItem, ContentStatus
import aiofiles
import os
import uuid

from app.services.storage import get_storage

router = APIRouter()

# Initialize storage
storage = get_storage()

@router.get("/upload/params")
async def get_upload_params(filename: str):
    params = await storage.get_upload_params(filename)
    return params

@router.post("/upload/finalize")
async def finalize_upload(
    original_filename: str = Form(...),
    storage_path: str = Form(...),
    metadata: str = Form("{}"),
    session: Session = Depends(get_session)
):
    # Create DB record after direct S3 upload or local fallback
    content_item = ContentItem(
        original_filename=original_filename,
        storage_path=storage_path,
        status=ContentStatus.UNPROCESSED,
        metadata_json=metadata
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
    storage_path = await storage.save(content, file.filename)
        
    # Create DB record (legacy/fallback support)
    content_item = ContentItem(
        original_filename=file.filename,
        storage_path=storage_path,
        status=ContentStatus.UNPROCESSED,
        metadata_json=metadata
    )
    session.add(content_item)
    session.commit()
    session.refresh(content_item)
    
    return content_item

@router.get("/items")
def read_items(session: Session = Depends(get_session)):
    items = session.query(ContentItem).all()
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

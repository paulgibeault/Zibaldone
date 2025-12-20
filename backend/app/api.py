from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlmodel import Session
from app.models import get_session, ContentItem, ContentStatus
import aiofiles
import os
import uuid

from app.services.storage import LocalObjectStore

router = APIRouter()

# Initialize storage (could be dependency injected)
storage = LocalObjectStore("../data/blob_storage")

@router.post("/upload")
async def upload_content(file: UploadFile = File(...), session: Session = Depends(get_session)):
    content = await file.read()
    storage_path = await storage.save(content, file.filename)
        
    # Create DB record
    content_item = ContentItem(
        original_filename=file.filename,
        storage_path=storage_path,
        status=ContentStatus.UNPROCESSED
    )
    session.add(content_item)
    session.commit()
    session.refresh(content_item)
    
    return content_item

@router.get("/items")
def read_items(session: Session = Depends(get_session)):
    items = session.query(ContentItem).all()
    return items

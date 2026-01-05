from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, Response
from sqlmodel import Session
from typing import Optional
import hashlib

from app.deps import get_current_user
from app.models import User, get_session
from app.services.storage import get_storage
from app import schemas
from app.services import item_service

router = APIRouter()
storage = get_storage()

def calculate_checksum(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()

@router.get("/upload/params")
async def get_upload_params(filename: str):
    params = await storage.get_upload_params(filename)
    return params

@router.post("/upload/finalize", response_model=schemas.ContentItemRead)
async def finalize_upload(
    original_filename: str = Form(...),
    storage_path: str = Form(...),
    metadata: str = Form("{}"),
    content_type: Optional[str] = Form(None),
    checksum: Optional[str] = Form(None),
    resolution: Optional[str] = Form(None),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    return await item_service.finalize_upload(
        session, original_filename, storage_path, current_user.id, metadata, content_type, checksum, resolution
    )

@router.post("/upload", response_model=schemas.ContentItemRead)
async def upload_content(
    file: UploadFile = File(...), 
    metadata: str = Form("{}"),
    resolution: Optional[str] = Form(None),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    content = await file.read()
    checksum = calculate_checksum(content)
    
    storage_path = await storage.save(content, file.filename)
    
    return await item_service.finalize_upload(
        session, file.filename, storage_path, current_user.id, metadata, file.content_type, checksum, resolution
    )

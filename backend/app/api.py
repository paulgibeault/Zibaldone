from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, Response
from sqlmodel import Session
from fastapi.responses import FileResponse, RedirectResponse
from typing import Optional, List
import os
import uuid
import hashlib

from app.deps import get_current_user
from app.models import User, get_session
from app.services.storage import get_storage
from app.exceptions import ResultNotFound
from app import crud, schemas
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
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    return await item_service.finalize_upload(
        session, original_filename, storage_path, current_user.id, metadata, content_type, checksum
    )

@router.post("/upload", response_model=schemas.ContentItemRead)
async def upload_content(
    file: UploadFile = File(...), 
    metadata: str = Form("{}"),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    content = await file.read()
    checksum = calculate_checksum(content)
    
    storage_path = await storage.save(content, file.filename)
    
    return await item_service.finalize_upload(
        session, file.filename, storage_path, current_user.id, metadata, file.content_type, checksum
    )

@router.get("/items", response_model=List[schemas.ContentItemRead])
def read_items(
    filename: Optional[str] = None,
    content_type: Optional[str] = None,
    after: Optional[str] = None,
    show_all_versions: bool = False,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    items = crud.get_items(session, current_user.id, filename, content_type, after, show_all_versions)
    return [item_service.enrich_item(item) for item in items]

@router.get("/items/{item_id}/download")
async def download_item(item_id: uuid.UUID, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    item = crud.get_item(session, item_id, current_user.id)
    if not item:
        raise ResultNotFound("Item not found")
        
    url = storage.get_download_url(item.storage_path)
    if url:
        return RedirectResponse(url=url)
        
    full_path = storage.get_path(item.storage_path)
    if not os.path.exists(full_path):
        raise ResultNotFound("File not found on disk")
        
    return FileResponse(full_path, filename=item.original_filename)

@router.get("/items/{item_id}/versions", response_model=List[schemas.ContentItemRead])
async def get_item_versions(item_id: uuid.UUID, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    versions = crud.get_item_versions(session, item_id, current_user.id)
    return [item_service.enrich_item(item) for item in versions]

@router.put("/items/{item_id}/metadata", response_model=schemas.ContentItemRead)
async def update_item_metadata(item_id: uuid.UUID, metadata: dict, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    item = crud.get_item(session, item_id, current_user.id)
    if not item:
        raise ResultNotFound("Item not found")
        
    updated_item = crud.update_item_metadata(session, item, metadata)
    await item_service.notify_item_update(item.id)
    return item_service.enrich_item(updated_item)

@router.post("/items/{item_id}/tags/{tag_id}", response_model=schemas.ContentItemRead)
async def add_tag_to_item(item_id: uuid.UUID, tag_id: uuid.UUID, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    item = crud.get_item(session, item_id, current_user.id)
    tag = crud.get_tag(session, tag_id, current_user.id)
    
    if not item or not tag:
        raise ResultNotFound("Item or Tag not found")

    if tag not in item.tags:
        item.tags.append(tag)
        session.add(item)
        session.commit()
        session.refresh(item)
        await item_service.notify_item_update(item.id)
        
    return item_service.enrich_item(item)

@router.delete("/items/{item_id}/tags/{tag_id}", response_model=schemas.ContentItemRead)
async def remove_tag_from_item(item_id: uuid.UUID, tag_id: uuid.UUID, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    item = crud.get_item(session, item_id, current_user.id)
    tag = crud.get_tag(session, tag_id, current_user.id)
    
    if not item or not tag:
        raise ResultNotFound("Item or Tag not found")
    
    if tag in item.tags:
        item.tags.remove(tag)
        session.add(item)
        session.commit()
        session.refresh(item)
        await item_service.notify_item_update(item.id)
        
    return item_service.enrich_item(item)

@router.delete("/items/{item_id}")
async def delete_item(item_id: uuid.UUID, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    item = crud.get_item(session, item_id, current_user.id)
    if not item:
        raise ResultNotFound("Item not found")
    
    crud.delete_item(session, item)
    
    return {"ok": True}

@router.get("/search", response_model=schemas.SearchResponse)
def search_content(
    q: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    results = crud.search_content(session, q, current_user.id)
    # enrich items
    results["items"] = [item_service.enrich_item(item) for item in results["items"]]
    return results

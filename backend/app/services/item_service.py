import uuid
from typing import Optional
from sqlmodel import Session
from app.models import ContentItem, ContentStatus
from app import crud, schemas
from app.services.storage import get_storage
from app.services.event_broadcaster import broadcaster
import json

storage = get_storage()

def enrich_item(item: ContentItem) -> schemas.ContentItemRead:
    url = storage.get_download_url(item.storage_path)
    if not url:
        # Local file or S3 error, point to our own download endpoint
        # If it's S3 error, this endpoint will likely 404, which is better than 500
        url = f"/api/items/{item.id}/download"
    
    # Map tags to TagRead
    tags = [schemas.TagRead.model_validate(t) for t in item.tags]
    
    # Map tasks to ProcessingTaskRead
    tasks = [schemas.ProcessingTaskRead.model_validate(t) for t in item.tasks]
    
    # Inject version into metadata for visibility
    meta_dict = {}
    if item.metadata_json:
        try:
            meta_dict = json.loads(item.metadata_json)
        except json.JSONDecodeError:
            pass
            
    meta_dict['version'] = item.version
    if item.client_file_path:
        meta_dict['client_file_path'] = item.client_file_path
        
    return schemas.ContentItemRead(
        id=item.id,
        status=item.status,
        original_filename=item.original_filename,
        version=item.version,
        client_file_path=item.client_file_path,
        storage_path=item.storage_path,
        created_at=item.created_at,
        metadata_json=json.dumps(meta_dict),
        download_url=url,
        tags=tags,
        tasks=tasks
    )

async def notify_item_update(item_id: uuid.UUID):
    await broadcaster.broadcast(json.dumps({"type": "update", "item_id": str(item_id)}))

async def finalize_upload(
    session: Session,
    original_filename: str,
    storage_path: str,
    owner_id: uuid.UUID,
    metadata: str = "{}",
    content_type: Optional[str] = None,
    checksum: Optional[str] = None
) -> schemas.ContentItemRead:
    version = 1
    client_file_path = None
    
    # Extract client_file_path from metadata if available
    if metadata:
        try:
            meta_dict = json.loads(metadata)
            client_ctx = meta_dict.get("client_context", {})
            # Use filePath if available, otherwise None
            client_file_path = client_ctx.get("filePath")
        except json.JSONDecodeError:
            pass
            
    version = crud.get_next_version(session, original_filename, owner_id, client_file_path)
    
    content_item = ContentItem(
        original_filename=original_filename,
        storage_path=storage_path,
        owner_id=owner_id,
        status=ContentStatus.QUEUED,
        metadata_json=metadata,
        version=version,
        content_type=content_type,
        checksum=checksum,
        client_file_path=client_file_path
    )
    
    item = crud.create_item(session, content_item)
    return enrich_item(item)

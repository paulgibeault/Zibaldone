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
        # Local file, point to our own download endpoint
        url = f"/api/items/{item.id}/download"
    
    # Map tags to TagRead
    tags = [schemas.TagRead(id=t.id, name=t.name, color=t.color) for t in item.tags]
    
    return schemas.ContentItemRead(
        id=item.id,
        status=item.status,
        original_filename=item.original_filename,
        storage_path=item.storage_path,
        created_at=item.created_at,
        metadata_json=item.metadata_json,
        download_url=url,
        tags=tags
    )

async def notify_item_update(item_id: uuid.UUID):
    await broadcaster.broadcast(json.dumps({"type": "update", "item_id": str(item_id)}))

async def finalize_upload(
    session: Session,
    original_filename: str,
    storage_path: str,
    metadata: str = "{}",
    content_type: Optional[str] = None,
    checksum: Optional[str] = None
) -> schemas.ContentItemRead:
    version = crud.get_next_version(session, original_filename)
    
    content_item = ContentItem(
        original_filename=original_filename,
        storage_path=storage_path,
        status=ContentStatus.UNPROCESSED,
        metadata_json=metadata,
        version=version,
        content_type=content_type,
        checksum=checksum
    )
    
    item = crud.create_item(session, content_item)
    return enrich_item(item)

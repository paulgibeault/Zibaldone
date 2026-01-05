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
    checksum: Optional[str] = None,
    resolution: Optional[str] = None
) -> schemas.ContentItemRead:
    import logging
    logger = logging.getLogger(__name__)

    version = 1
    client_file_path = None
    tlsh_hash = None
    
    logger.info(f"finalize_upload: filename={original_filename}, path={storage_path}, checksum={checksum}, has_metadata={bool(metadata)}")

    # Calculate TLSH if possible
    # We need the content to calculate TLSH. Ideally this is done before saving or we read it back.
    # storage_path usually points to a file we just saved.
    # Note: Using storage.read() might be expensive for S3. 
    # For now, let's assume we can read it cheaply or we do it upstream in api.py if we had the bytes.
    # However, existing api.py `upload_content` reads bytes. `finalize_upload` endpoint (multipart) relies on client?
    # Wait, `finalize_upload` is mainly for chunked uploads where backend might not have full content easily accessible here unless it stitches it.
    # But `upload_content` (simple upload) has content.
    # Let's try to calculate TLSH from the file on disk if it exists locally, or skip if remote/expensive.
    # Actually, `api.py` upload_content has the content in memory. We should pass it?
    # For this refactor, let's compute it here if we can read the file.
    
    from app.services.storage import get_storage
    storage = get_storage()
    # Attempt to read header of file for TLSH
    try:
        import tlsh
        # TLSH needs at least 50 chars usually.
        # Use storage.get_content() to handle both local and S3
        data = await storage.get_content(storage_path)
        if data:
            tlsh_hash = tlsh.hash(data)
            logger.info(f"Calculated TLSH: {tlsh_hash}")
    except Exception as e:
        logger.warning(f"Failed to calculate TLSH: {e}")
        pass

    # Extract client_file_path and signature from metadata if available
    signature = None
    meta_dict = {}
    if metadata:
        try:
            meta_dict = json.loads(metadata)
            client_ctx = meta_dict.get("client_context", {})
            # Use filePath if available, otherwise None
            client_file_path = client_ctx.get("filePath")
            signature = client_ctx.get("signature")
            logger.info(f"Metadata extracted: path={client_file_path}, sig={signature}")
        except json.JSONDecodeError:
            logger.error("Failed to parse metadata JSON")
            pass
            
    # Check for existing duplicate first
    if checksum:
        latest_item = crud.get_latest_item(session, original_filename, owner_id, client_file_path)
        if latest_item and latest_item.checksum == checksum:
            logger.info("Duplicate checksum found. Returning existing item.")
            return enrich_item(latest_item)

    from app.exceptions import IdentityConflictError
    from fastapi import HTTPException
    
    try:
        version = crud.get_next_version(
            session=session, 
            filename=original_filename, 
            owner_id=owner_id, 
            client_file_path=client_file_path, 
            signature=signature,
            tlsh_hash=tlsh_hash,
            resolution=resolution
        )
        logger.info(f"Determined next version: {version}")
    except IdentityConflictError as e:
        logger.error(f"Identity conflict: {e}")
        raise HTTPException(status_code=409, detail=e.message)
    
    # Update metadata with TLSH for future reference
    if tlsh_hash:
        meta_dict["tlsh"] = tlsh_hash
        metadata = json.dumps(meta_dict)

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

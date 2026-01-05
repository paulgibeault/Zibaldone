import uuid
from typing import Optional
from sqlmodel import Session, select, desc
from app.models import ContentItem, ContentStatus
from app import crud, schemas
from app.services.storage import get_storage
from app.services.event_broadcaster import broadcaster
from app.exceptions import IdentityConflictError
import json
import logging

storage = get_storage()
logger = logging.getLogger(__name__)

def enrich_item(item: ContentItem) -> schemas.ContentItemRead:
    url = storage.get_download_url(item.storage_path)
    if not url:
        url = f"/api/items/{item.id}/download"
    
    tags = [schemas.TagRead.model_validate(t) for t in item.tags]
    tasks = [schemas.ProcessingTaskRead.model_validate(t) for t in item.tasks]
    
    # Inject version into metadata for visibility
    # copy so we don't mutate the db object's dict in memory persistently if cached
    meta_dict = item.item_metadata.copy() if item.item_metadata else {}
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
        metadata_json=json.dumps(meta_dict), # Schema still expects json string for now? Check schemas.py
        download_url=url,
        tags=tags,
        tasks=tasks
    )

def _is_fuzzy_match(hash1: Optional[str], hash2: Optional[str], threshold: int = 100) -> bool:
    if not hash1 or not hash2:
        return False
    try:
        import tlsh
        score = tlsh.diff(hash1, hash2)
        logger.info(f"TLSH Score: {score} (Threshold: {threshold}) -> {'MATCH' if score < threshold else 'MISMATCH'}")
        return score < threshold
    except ImportError:
        logger.warning("TLSH not installed, cannot compare.")
        return False
    except Exception as e:
        logger.error(f"TLSH comparison error: {e}")
        return False

def calculate_next_version(
    session: Session, 
    filename: str, 
    owner_id: uuid.UUID, 
    client_file_path: Optional[str] = None, 
    signature: Optional[str] = None,
    tlsh_hash: Optional[str] = None,
    resolution: Optional[str] = None
) -> tuple[int, Optional[ContentItem]]:
    
    if resolution == 'new_file':
        return 1, None

    statement = select(ContentItem)\
        .where(ContentItem.original_filename == filename)\
        .where(ContentItem.owner_id == owner_id)\
        .where(ContentItem.is_latest == True)
        
    candidates = session.exec(statement).all()
    latest_candidate: Optional[ContentItem] = None
    
    for c in candidates:
        if c.client_file_path == client_file_path:
             latest_candidate = c
             break
        is_implicit_req = not client_file_path or client_file_path == filename
        is_implicit_cand = not c.client_file_path or c.client_file_path == filename
        if is_implicit_req and is_implicit_cand:
             latest_candidate = c
             break
             
    if not latest_candidate:
        return 1, None
        
    if resolution == 'new_version':
        return latest_candidate.version + 1, latest_candidate

    meta = latest_candidate.item_metadata or {}
    latest_sig = meta.get("client_context", {}).get("signature")
    latest_tlsh = meta.get("tlsh")
    
    if latest_sig and signature:
        if latest_sig != signature:
             if _is_fuzzy_match(latest_tlsh, tlsh_hash):
                 return latest_candidate.version + 1, latest_candidate
             else:
                 raise IdentityConflictError(
                     message=f"File '{filename}' already exists but looks different.",
                     details={"filename": filename}
                 )
        else:
             if tlsh_hash and latest_tlsh:
                 if not _is_fuzzy_match(latest_tlsh, tlsh_hash):
                      raise IdentityConflictError(
                          message=f"File '{filename}' has matching header but different content.",
                          details={"filename": filename}
                      )
                      
    return latest_candidate.version + 1, latest_candidate

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
    
    version = 1
    client_file_path = None
    tlsh_hash = None
    
    logger.info(f"finalize_upload: filename={original_filename}, path={storage_path}, checksum={checksum}, has_metadata={bool(metadata)}")

    from app.services.storage import get_storage
    storage = get_storage()
    # Attempt to read header of file for TLSH
    try:
        import tlsh
        # TLSH needs at least 50 chars usually.
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
        version, previous_latest = calculate_next_version(
            session=session, 
            filename=original_filename, 
            owner_id=owner_id, 
            client_file_path=client_file_path, 
            signature=signature,
            tlsh_hash=tlsh_hash,
            resolution=resolution
        )
        logger.info(f"Determined next version: {version}")
        
        if previous_latest:
            previous_latest.is_latest = False
            session.add(previous_latest)
            session.flush() # Ensure update is pending?
            
    except IdentityConflictError as e:
        logger.error(f"Identity conflict: {e}")
        raise HTTPException(status_code=409, detail=e.message)
    
    # Update metadata with TLSH for future reference
    if tlsh_hash:
        meta_dict["tlsh"] = tlsh_hash
        # No need to dump back to string for db, but we need it in dict form
        
    content_item = ContentItem(
        original_filename=original_filename,
        storage_path=storage_path,
        owner_id=owner_id,
        status=ContentStatus.QUEUED,
        item_metadata=meta_dict, # Pass dict directly
        version=version,
        is_latest=True, # New item is always latest
        content_type=content_type,
        checksum=checksum,
        client_file_path=client_file_path
    )
    
    item = crud.create_item(session, content_item)
    return enrich_item(item)

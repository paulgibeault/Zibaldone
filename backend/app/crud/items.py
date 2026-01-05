from typing import List, Optional
from datetime import datetime
import uuid
import json
import logging
from sqlmodel import Session, select, desc
from sqlalchemy.orm import selectinload, aliased
from sqlalchemy import or_, and_
from app.models import ContentItem
from app.exceptions import IdentityConflictError

logger = logging.getLogger(__name__)

def get_latest_item(session: Session, filename: str, owner_id: uuid.UUID, client_file_path: Optional[str] = None) -> Optional[ContentItem]:
    statement = select(ContentItem).where(ContentItem.original_filename == filename).where(ContentItem.owner_id == owner_id)
    
    if client_file_path:
        statement = statement.where(ContentItem.client_file_path == client_file_path)
    else:
        # If no path provided, match items where path is NULL
        statement = statement.where(ContentItem.client_file_path == None)

    statement = statement.order_by(desc(ContentItem.version))
    return session.exec(statement).first()

def _is_fuzzy_match(hash1: Optional[str], hash2: Optional[str], threshold: int = 100) -> bool:
    """Returns True if two TLSH hashes are similar enough."""
    if not hash1 or not hash2:
        return False
    try:
        import tlsh
        # diff() returns a score usually 0-1000+. 
        # < 30 is strict match, < 100 is roughly similar.
        score = tlsh.diff(hash1, hash2)
        logger.info(f"TLSH Score: {score} (Threshold: {threshold}) -> {'MATCH' if score < threshold else 'MISMATCH'}")
        return score < threshold
    except ImportError:
        # If tlsh not installed, fail safe (no match)
        logger.warning("TLSH not installed, cannot compare.")
        return False
    except Exception as e:
        logger.error(f"TLSH comparison error: {e}")
        return False

def get_next_version(
    session: Session, 
    filename: str, 
    owner_id: uuid.UUID, 
    client_file_path: Optional[str] = None, 
    signature: Optional[str] = None,
    client_last_modified: Optional[str] = None,
    client_size: Optional[int] = None,
    tlsh_hash: Optional[str] = None,
    resolution: Optional[str] = None
) -> int:
    # 0. RESOLUTION OVERRIDES
    logger.info(f"get_next_version: filename={filename}, path={client_file_path}, sig={signature}, res={resolution}")
    
    if resolution == 'new_file':
        logger.info("Resolution is 'new_file', returning 1")
        return 1
    # If resolution == 'new_version', we simply proceed to return version+1 without raising conflicts.

    # 1. FIND CANDIDATE (Explicit or Implicit)
    latest_candidate = None
    
    # Try explicit path first if valid
    is_explicit_path = client_file_path and client_file_path != filename
    if is_explicit_path:
        logger.info(f"Explicit path provided: {client_file_path}. Searching for existing versions.")
        statement = select(ContentItem)\
            .where(ContentItem.original_filename == filename)\
            .where(ContentItem.owner_id == owner_id)\
            .where(ContentItem.client_file_path == client_file_path)\
            .order_by(desc(ContentItem.version))
        latest_candidate = session.exec(statement).first()
        
    # If no explicit candidate (or not explicit path), try implicit candidates
    if not latest_candidate:
        # Default to implicit search if explicitly not found or not provided?
        # If explicit path was provided BUT not found in DB, it means it's a NEW file at that explicit path.
        # So we should ONLY search implicit if is_explicit_path is False.
        if not is_explicit_path:
            statement = select(ContentItem)\
                .where(ContentItem.original_filename == filename)\
                .where(ContentItem.owner_id == owner_id)\
                .order_by(desc(ContentItem.version))
            candidates = session.exec(statement).all()
            
            # Filter candidates to only those with implicit paths (None or == filename)
            for c in candidates:
                if c.client_file_path is None or c.client_file_path == c.original_filename:
                    latest_candidate = c
                    break

    if not latest_candidate:
        logger.info("No existing candidate found. returning 1")
        return 1
        
    logger.info(f"Found latest candidate: id={latest_candidate.id}, version={latest_candidate.version}")
    
    # If user explicitly said "new_version", skip checks
    if resolution == 'new_version':
        logger.info("Resolution is 'new_version', incrementing version.")
        return latest_candidate.version + 1

    # 2. IDENTITY CHECKS
    # Use metrics to determine if this is likely the same file
    
    latest_meta = {}
    try:
        latest_meta = json.loads(latest_candidate.metadata_json)
    except:
        pass
        
    latest_client_ctx = latest_meta.get("client_context", {})
    latest_signature = latest_client_ctx.get("signature")
    
    logger.info(f"Comparing signatures: latest={latest_signature}, incoming={signature}")
    
    # A. Signature Check (Strongest Heuristic)
    if latest_signature and signature:
        if latest_signature != signature:
             # Signature Mismatch - Likely different file
             logger.info("Signature mismatch detected.")
             # TRY OPTION 3: FUZZY HASH RECOVERY
             logger.info(f"Comparing TLSH: latest={latest_meta.get('tlsh')}, incoming={tlsh_hash}")
             if _is_fuzzy_match(latest_meta.get("tlsh"), tlsh_hash, threshold=100):
                 # It's a match! Just heavily edited.
                 logger.info("Fuzzy match successful despite signature mismatch. Incrementing version.")
                 return latest_candidate.version + 1
             else:
                 # Real Conflict
                 logger.warning("Conflict detected: Signature and Fuzzy Hash mismatch.")
                 raise IdentityConflictError(
                     message=f"File '{filename}' already exists but looks different.",
                     details={"filename": filename}
                 )
        else:
             # Signature Match - Headers match. 
             # Check if the BODY is significantly different (Fuzzy Mismatch).
             # If completely different, it might be a collision (e.g. same unrelated header).
             if tlsh_hash and latest_meta.get("tlsh"):
                 if not _is_fuzzy_match(latest_meta.get("tlsh"), tlsh_hash, threshold=100):
                     # Significant difference despite header match.
                     # Prompt user to be safe.
                     logger.warning("Conflict detected: Signature match but Fuzzy Hash mismatch.")
                     raise IdentityConflictError(
                         message=f"File '{filename}' has matching header but different content.",
                         details={"filename": filename}
                     )

    # B. Metadata Check (Secondary)
    # If signatures are missing (e.g. binary files), check creation time or size stability?
    # Actually, size changes on edit. Creation time might be stable?
    # For now, if no signature, we assume same file (legacy behavior) unless we add more strictness later.
    
    logger.info("Identity checks passed or skipped. Incrementing version.")
    return latest_candidate.version + 1

def _get_next_version_db(session: Session, filename: str, owner_id: uuid.UUID, client_file_path: Optional[str]) -> int:
    statement = select(ContentItem).where(ContentItem.original_filename == filename).where(ContentItem.owner_id == owner_id)
    statement = statement.where(ContentItem.client_file_path == client_file_path)
    statement = statement.order_by(desc(ContentItem.version))
    
    latest = session.exec(statement).first()
    if latest:
        return latest.version + 1
    return 1

def get_items(
    session: Session,
    owner_id: uuid.UUID,
    filename: Optional[str] = None,
    content_type: Optional[str] = None,
    after: Optional[str] = None,
    show_all_versions: bool = False
) -> List[ContentItem]:
    statement = select(ContentItem).where(ContentItem.owner_id == owner_id).options(
        selectinload(ContentItem.tags),
        selectinload(ContentItem.tasks)
    )
    
    if filename:
        statement = statement.where(ContentItem.original_filename == filename)
    if content_type:
        statement = statement.where(ContentItem.content_type == content_type)
    if after:
        try:
            after_dt = datetime.fromisoformat(after)
            statement = statement.where(ContentItem.created_at >= after_dt)
        except ValueError:
            pass
            
    if not show_all_versions:
        c2 = aliased(ContentItem)
        subquery = (
            select(1)
            .where(c2.original_filename == ContentItem.original_filename)
        )
        
        # We need to correlate by client_file_path too.
        subquery = subquery.where(
            or_(
                c2.client_file_path == ContentItem.client_file_path,
                and_(c2.client_file_path == None, ContentItem.client_file_path == None)
            )
        )
        
        subquery = subquery.where(c2.version > ContentItem.version)

        statement = statement.where(~subquery.exists())
    
    statement = statement.order_by(desc(ContentItem.created_at))
    return session.exec(statement).all()

def get_item(session: Session, item_id: uuid.UUID, owner_id: uuid.UUID) -> Optional[ContentItem]:
    return session.exec(
        select(ContentItem)
        .where(ContentItem.id == item_id)
        .where(ContentItem.owner_id == owner_id)
        .options(
            selectinload(ContentItem.tags),
            selectinload(ContentItem.tasks)
        )
    ).first()

def create_item(session: Session, item: ContentItem) -> ContentItem:
    session.add(item)
    session.commit()
    session.refresh(item)
    return item

def get_item_versions(session: Session, item_id: uuid.UUID, owner_id: uuid.UUID) -> List[ContentItem]:
    # 1. Get the item to identify key attributes
    current_item = get_item(session, item_id, owner_id)
    if not current_item:
        return []
        
    # 2. Find siblings
    statement = select(ContentItem).where(ContentItem.original_filename == current_item.original_filename).where(ContentItem.owner_id == owner_id)
    
    if current_item.client_file_path:
        statement = statement.where(ContentItem.client_file_path == current_item.client_file_path)
    else:
        statement = statement.where(ContentItem.client_file_path == None)
        
    statement = statement.order_by(desc(ContentItem.version))
    return session.exec(statement).all()

def update_item_metadata(session: Session, item: ContentItem, metadata: dict) -> ContentItem:
    item.metadata_json = json.dumps(metadata)
    session.add(item)
    session.commit()
    session.refresh(item)
    return item

def delete_item(session: Session, item: ContentItem):
    session.delete(item)
    session.commit()

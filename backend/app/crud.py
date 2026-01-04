from typing import List, Optional
from datetime import datetime
import uuid
from sqlmodel import Session, select, desc
from sqlalchemy.orm import selectinload
from app.models import ContentItem, Tag, ContentItemTagLink, ProcessingTask, TaskStatus

# Forced update to trigger rebuild
def get_latest_item(session: Session, filename: str, owner_id: uuid.UUID, client_file_path: Optional[str] = None) -> Optional[ContentItem]:
    statement = select(ContentItem).where(ContentItem.original_filename == filename).where(ContentItem.owner_id == owner_id)
    
    if client_file_path:
        statement = statement.where(ContentItem.client_file_path == client_file_path)
    else:
        # If no path provided, match items where path is NULL
        statement = statement.where(ContentItem.client_file_path == None)

    statement = statement.order_by(desc(ContentItem.version))
    return session.exec(statement).first()

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
    import json
    
    # 0. RESOLUTION OVERRIDES
    if resolution == 'new_file':
        return 1
    # If resolution == 'new_version', we simply proceed to return version+1 without raising conflicts.

    # 1. EXPLICIT PATH: Trust it if provided and unique
    is_explicit_path = client_file_path and client_file_path != filename
    
    if is_explicit_path:
        # Trust the explicit path, ignore signature (user intends to update specific file)
        return _get_next_version_db(session, filename, owner_id, client_file_path)

    # 2. IMPLICIT/AMBIGUOUS PATH
    # We query for items that also have ambiguous paths (None or same as filename)
    statement = select(ContentItem)\
        .where(ContentItem.original_filename == filename)\
        .where(ContentItem.owner_id == owner_id)\
        .order_by(desc(ContentItem.version))
        
    candidates = session.exec(statement).all()
    
    # Filter candidates to only those with implicit paths (None or == filename)
    filtered_candidates = []
    for c in candidates:
        if c.client_file_path is None or c.client_file_path == c.original_filename:
            filtered_candidates.append(c)
            
    if not filtered_candidates:
        return 1
        
    latest_candidate = filtered_candidates[0]
    
    # If user explicitly said "new_version", skip checks
    if resolution == 'new_version':
        return latest_candidate.version + 1

    # 3. IDENTITY CHECKS
    # Use metrics to determine if this is likely the same file
    
    latest_meta = {}
    try:
        latest_meta = json.loads(latest_candidate.metadata_json)
    except:
        pass
        
    latest_client_ctx = latest_meta.get("client_context", {})
    latest_signature = latest_client_ctx.get("signature")
    
    # A. Signature Check (Strongest Heuristic)
    if latest_signature and signature:
        if latest_signature != signature:
             # Signature Mismatch - Likely different file
             # TRY OPTION 3: FUZZY HASH RECOVERY
             if _is_fuzzy_match(latest_meta.get("tlsh"), tlsh_hash):
                 # It's a match! Just heavily edited.
                 return latest_candidate.version + 1
             else:
                 # Real Conflict
                 from app.exceptions import IdentityConflictError
                 raise IdentityConflictError(
                     message=f"File '{filename}' already exists but looks different.",
                     details={"filename": filename}
                 )
        else:
             # Signature Match - Headers match. 
             # Check if the BODY is significantly different (Fuzzy Mismatch).
             # If completely different, it might be a collision (e.g. same unrelated header).
             if tlsh_hash and latest_meta.get("tlsh"):
                 if not _is_fuzzy_match(latest_meta.get("tlsh"), tlsh_hash):
                     # Significant difference despite header match.
                     # Prompt user to be safe.
                     from app.exceptions import IdentityConflictError
                     raise IdentityConflictError(
                         message=f"File '{filename}' has matching header but different content.",
                         details={"filename": filename}
                     )

    # B. Metadata Check (Secondary)
    # If signatures are missing (e.g. binary files), check creation time or size stability?
    # Actually, size changes on edit. Creation time might be stable?
    # For now, if no signature, we assume same file (legacy behavior) unless we add more strictness later.
    
    return latest_candidate.version + 1

def _is_fuzzy_match(hash1: Optional[str], hash2: Optional[str]) -> bool:
    """Returns True if two TLSH hashes are similar enough."""
    if not hash1 or not hash2:
        return False
    try:
        import tlsh
        # diff() returns a score usually 0-1000+. 
        # < 30 is strict match, < 100 is roughly similar.
        score = tlsh.diff(hash1, hash2)
        return score < 100
    except ImportError:
        # If tlsh not installed, fail safe (no match)
        return False
    except Exception:
        return False

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
        from sqlalchemy.orm import aliased
        c2 = aliased(ContentItem)
        subquery = (
            select(1)
            .where(c2.original_filename == ContentItem.original_filename)
        )
        
        # We need to correlate by client_file_path too.
        # If ContentItem.client_file_path is NULL, c2.client_file_path must be NULL.
        # If ContentItem.client_file_path is "foo", c2.client_file_path must be "foo".
        # Simple equality works if both are non-null. For NULL equality, we might need care.
        # SQLModel/SQLAlchemy '==' usually handles None as "IS NULL" in WHERE generation?
        # But here we are comparing two columns.
        # Postgres supports "IS NOT DISTINCT FROM". SQLite supports "IS".
        # Let's use the `is_not_distinct_from` operator if available or standard `==`.
        # Actually, for SQLite, `IS` works for comparing two columns including NULLs.
        # `where(c2.client_file_path.is_(ContentItem.client_file_path))`? No `is_` creates `IS NULL` check for value.
        # `where(c2.client_file_path == ContentItem.client_file_path)` generates `a = b`. `NULL = NULL` is False.
        # We need `(c2.client_file_path == ContentItem.client_file_path) | ((c2.client_file_path == None) & (ContentItem.client_file_path == None))`
        
        from sqlalchemy import or_, and_
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
    import json
    item.metadata_json = json.dumps(metadata)
    session.add(item)
    session.commit()
    session.refresh(item)
    return item

def delete_item(session: Session, item: ContentItem):
    session.delete(item)
    session.commit()

# Tag operations
def get_tags(session: Session, owner_id: uuid.UUID, approved_only: bool = False) -> List[Tag]:
    statement = select(Tag).where(Tag.owner_id == owner_id)
    if approved_only:
        statement = statement.where(Tag.is_approved == True)
    return session.exec(statement).all()

def get_tag(session: Session, tag_id: uuid.UUID, owner_id: uuid.UUID) -> Optional[Tag]:
    return session.exec(select(Tag).where(Tag.id == tag_id).where(Tag.owner_id == owner_id)).first()

def create_tag(session: Session, name: str, color: str, owner_id: uuid.UUID, is_autocreated: bool = False, is_approved: bool = True) -> Tag:
    tag = Tag(name=name, color=color, owner_id=owner_id, is_autocreated=is_autocreated, is_approved=is_approved)
    session.add(tag)
    session.commit()
    session.refresh(tag)
    return tag

def get_tag_by_name(session: Session, name: str, owner_id: uuid.UUID) -> Optional[Tag]:
    return session.exec(select(Tag).where(Tag.name == name).where(Tag.owner_id == owner_id)).first()

def approve_tag(session: Session, tag_id: uuid.UUID) -> Optional[Tag]:
    tag = session.get(Tag, tag_id)
    if tag:
        tag.is_approved = True
        
        # If tag still has default color, assign a random one
        if tag.color == "#888888":
            import random
            # Vibrant colors palette
            colors = [
                "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#10b981", 
                "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#d946ef", 
                "#f43f5e"
            ]
            tag.color = random.choice(colors)
            
        session.add(tag)
        session.commit()
        session.refresh(tag)
    return tag

def update_tag(session: Session, tag: Tag, name: Optional[str] = None, color: Optional[str] = None) -> Tag:
    if name:
        tag.name = name
    if color:
        tag.color = color
    session.add(tag)
    session.commit()
    session.refresh(tag)
    return tag

def delete_tag(session: Session, tag: Tag):
    session.delete(tag)
    session.commit()

# Processing Task operations
def create_task(session: Session, task: ProcessingTask) -> ProcessingTask:
    session.add(task)
    session.commit()
    session.refresh(task)
    return task

def update_task(
    session: Session, 
    task_id: uuid.UUID, 
    status: Optional[TaskStatus] = None, 
    message: Optional[str] = None,
    end_time: Optional[datetime] = None
) -> Optional[ProcessingTask]:
    task = session.get(ProcessingTask, task_id)
    if task:
        if status:
            task.status = status
        if message:
            task.message = message
        if end_time:
            task.end_time = end_time
        session.add(task)
        session.commit()
        session.refresh(task)
    return task

def search_content(session: Session, query: str, owner_id: uuid.UUID) -> dict:
    terms = query.strip().split()
    if not terms:
        return {"tags": [], "items": []}
    
    # 1. Search Tags
    # A tag matches if its name contains ALL terms (case-insensitive)? 
    # Or matches ANY term? usually search is "find things related to these words".
    # But usually "tag search" is exact or prefix. 
    # Given "space delimited", if I search "web dev", I expect tags that match "web" AND "dev"? 
    # Or maybe "web-dev".
    # Let's try: Tag name must contain at least one of the terms? 
    # Or Tag name must match the query string? 
    # User said: "return results from tags... who contain the search terms... in their name"
    # I will assume standard search engine logic: AND (intersection) of results for each term.
    # So for a tag to match, it must match specific criteria for ALL terms.
    # Actually, for tags, usually you want to find "python" tag when you type "python".
    # If I type "python coding", "python" tag doesn't contain "coding".
    # So for tags, maybe it's "Name contains ANY of the terms"? 
    # Let's go with: Tag matches if its name contains ANY of the terms.
    
    from sqlalchemy import or_, and_
    
    # helper to build LIKE clause
    def build_like(column, term):
        return column.ilike(f"%{term}%")

    # Tags: Match ANY term
    tag_conditions = [build_like(Tag.name, term) for term in terms]
    tag_statement = select(Tag).where(or_(*tag_conditions)).where(Tag.is_approved == True).where(Tag.owner_id == owner_id)
    tags = session.exec(tag_statement).all()
    
    # Items: Match ALL terms across fields
    # For each term, it must be in (original_filename OR metadata_json)
    # This matches the intuition of "invoice 2024" finding "invoice.pdf" with "2024" in metadata
    item_statement = select(ContentItem).where(ContentItem.owner_id == owner_id).options(
        selectinload(ContentItem.tags),
        selectinload(ContentItem.tasks)
    )
    
    for term in terms:
        # Each term must be present in at least one of these columns
        term_condition = or_(
            build_like(ContentItem.original_filename, term),
            build_like(ContentItem.metadata_json, term)
        )
        item_statement = item_statement.where(term_condition)
        
    # Exclude newer versions (similar to get_items logic)
    from sqlalchemy.orm import aliased
    c2 = aliased(ContentItem)
    subquery = (
        select(1)
        .where(c2.original_filename == ContentItem.original_filename)
        .where(c2.version > ContentItem.version)
    )
    item_statement = item_statement.where(~subquery.exists())
    
    items = session.exec(item_statement).all()
    
    return {"tags": tags, "items": items}

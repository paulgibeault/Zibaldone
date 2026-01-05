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
        statement = statement.where(ContentItem.is_latest == True)
    
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
    item.item_metadata = metadata
    session.add(item)
    session.commit()
    session.refresh(item)
    return item

def delete_item(session: Session, item: ContentItem):
    session.delete(item)
    session.commit()

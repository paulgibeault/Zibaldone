from typing import List, Optional
import uuid
from sqlmodel import Session, select, desc
from sqlalchemy.orm import selectinload
from app.models import ContentItem, Tag, ContentItemTagLink

def get_next_version(session: Session, filename: str) -> int:
    statement = select(ContentItem).where(ContentItem.original_filename == filename).order_by(desc(ContentItem.version))
    latest_item = session.exec(statement).first()
    if latest_item:
        return latest_item.version + 1
    return 1

def get_items(
    session: Session,
    filename: Optional[str] = None,
    content_type: Optional[str] = None,
    after: Optional[str] = None,
    show_all_versions: bool = False
) -> List[ContentItem]:
    statement = select(ContentItem).options(selectinload(ContentItem.tags))
    
    if filename:
        statement = statement.where(ContentItem.original_filename == filename)
    if content_type:
        statement = statement.where(ContentItem.content_type == content_type)
    if after:
        from datetime import datetime
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
            .where(c2.version > ContentItem.version)
        )
        statement = statement.where(~subquery.exists())
    
    return session.exec(statement).all()

def get_item(session: Session, item_id: uuid.UUID) -> Optional[ContentItem]:
    return session.exec(
        select(ContentItem)
        .where(ContentItem.id == item_id)
        .options(selectinload(ContentItem.tags))
    ).first()

def create_item(session: Session, item: ContentItem) -> ContentItem:
    session.add(item)
    session.commit()
    session.refresh(item)
    return item

def delete_item(session: Session, item: ContentItem):
    session.delete(item)
    session.commit()

# Tag operations
def get_tags(session: Session) -> List[Tag]:
    return session.exec(select(Tag)).all()

def get_tag(session: Session, tag_id: uuid.UUID) -> Optional[Tag]:
    return session.get(Tag, tag_id)

def create_tag(session: Session, name: str, color: str) -> Tag:
    tag = Tag(name=name, color=color)
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

from typing import List, Optional
from datetime import datetime
import uuid
from sqlmodel import Session, select, desc
from sqlalchemy.orm import selectinload
from app.models import ContentItem, Tag, ContentItemTagLink, ProcessingTask, TaskStatus

# Forced update to trigger rebuild
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
    statement = select(ContentItem).options(
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
            .where(c2.version > ContentItem.version)
        )
        statement = statement.where(~subquery.exists())
    
    return session.exec(statement).all()

def get_item(session: Session, item_id: uuid.UUID) -> Optional[ContentItem]:
    return session.exec(
        select(ContentItem)
        .where(ContentItem.id == item_id)
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

def delete_item(session: Session, item: ContentItem):
    session.delete(item)
    session.commit()

# Tag operations
def get_tags(session: Session) -> List[Tag]:
    return session.exec(select(Tag)).all()

def get_tag(session: Session, tag_id: uuid.UUID) -> Optional[Tag]:
    return session.get(Tag, tag_id)

def create_tag(session: Session, name: str, color: str, is_autocreated: bool = False, is_approved: bool = True) -> Tag:
    tag = Tag(name=name, color=color, is_autocreated=is_autocreated, is_approved=is_approved)
    session.add(tag)
    session.commit()
    session.refresh(tag)
    return tag

def get_tag_by_name(session: Session, name: str) -> Optional[Tag]:
    return session.exec(select(Tag).where(Tag.name == name)).first()

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

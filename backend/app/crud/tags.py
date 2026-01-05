from typing import List, Optional
import uuid
import random
from sqlmodel import Session, select
from app.models import Tag

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

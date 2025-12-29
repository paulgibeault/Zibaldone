from fastapi import APIRouter, Depends, HTTPException
from typing import List
from sqlmodel import Session, select
from app.models import get_session, Tag
import uuid

router = APIRouter()

@router.get("/tags", response_model=List[Tag])
def read_tags(session: Session = Depends(get_session)):
    tags = session.exec(select(Tag)).all()
    return tags

@router.post("/tags", response_model=Tag)
def create_tag(tag: Tag, session: Session = Depends(get_session)):
    # Check if tag with same name already exists
    statement = select(Tag).where(Tag.name == tag.name)
    existing_tag = session.exec(statement).first()
    if existing_tag:
        raise HTTPException(status_code=400, detail="Tag already exists")
    
    session.add(tag)
    session.commit()
    session.refresh(tag)
    return tag

@router.patch("/tags/{tag_id}", response_model=Tag)
def update_tag(tag_id: uuid.UUID, tag_data: dict, session: Session = Depends(get_session)):
    db_tag = session.get(Tag, tag_id)
    if not db_tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    
    for key, value in tag_data.items():
        if hasattr(db_tag, key):
            setattr(db_tag, key, value)
            
    session.add(db_tag)
    session.commit()
    session.refresh(db_tag)
    return db_tag

@router.delete("/tags/{tag_id}")
def delete_tag(tag_id: uuid.UUID, session: Session = Depends(get_session)):
    tag = session.get(Tag, tag_id)
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    
    session.delete(tag)
    session.commit()
    return {"ok": True}

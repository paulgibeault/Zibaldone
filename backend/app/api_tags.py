from fastapi import APIRouter, Depends, HTTPException
from typing import List
from sqlmodel import Session
import uuid
from app.models import get_session
from app import crud, schemas

router = APIRouter()

@router.get("/tags", response_model=List[schemas.TagRead])
def read_tags(session: Session = Depends(get_session)):
    return crud.get_tags(session)

@router.post("/tags", response_model=schemas.TagRead)
def create_tag(tag: schemas.TagCreate, session: Session = Depends(get_session)):
    # Check if tag with same name already exists
    from sqlmodel import select
    from app.models import Tag
    statement = select(Tag).where(Tag.name == tag.name)
    existing_tag = session.exec(statement).first()
    if existing_tag:
        raise HTTPException(status_code=400, detail="Tag already exists")
    
    return crud.create_tag(session, tag.name, tag.color)

@router.patch("/tags/{tag_id}", response_model=schemas.TagRead)
def update_tag(tag_id: uuid.UUID, tag_data: schemas.TagUpdate, session: Session = Depends(get_session)):
    db_tag = crud.get_tag(session, tag_id)
    if not db_tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    
    return crud.update_tag(session, db_tag, tag_data.name, tag_data.color)

@router.delete("/tags/{tag_id}")
def delete_tag(tag_id: uuid.UUID, session: Session = Depends(get_session)):
    tag = crud.get_tag(session, tag_id)
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    
    crud.delete_tag(session, tag)
    return {"ok": True}

from typing import List, Dict, Any, Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlmodel import Session, select
from datetime import datetime, timezone
from pydantic import BaseModel

from app.models import get_session, ProcessingTask, TaskStatus, ContentItem
from app.services.skill_registry import skill_registry
from app.workers import execute_task

router = APIRouter(
    prefix="/skills",
    tags=["skills"]
)

class SkillDTO(BaseModel):
    name: str
    description: str
    parameters: Dict[str, Any]

class TriggerSkillRequest(BaseModel):
    item_id: uuid.UUID
    parameters: Optional[Dict[str, Any]] = {}

@router.get("/", response_model=List[SkillDTO])
async def list_skills():
    """
    List all available skills.
    """
    skill_registry.load_skills() # Reload to ensure fresh list
    skills = []
    for name, config in skill_registry.skills.items():
        skills.append(SkillDTO(
            name=config.name,
            description=config.description,
            parameters={k: v.dict() for k, v in config.parameters.items()}
        ))
    return skills

@router.post("/{skill_name}/trigger")
async def trigger_skill(
    skill_name: str,
    request: TriggerSkillRequest,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session)
):
    """
    Trigger a specific skill for an item.
    """
    skill_config = skill_registry.get_skill(skill_name)
    if not skill_config:
        raise HTTPException(status_code=404, detail="Skill not found")

    item = session.get(ContentItem, request.item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Merge default parameters with request parameters
    params = {}
    for k, v in skill_config.parameters.items():
        params[k] = v.default
    
    if request.parameters:
        params.update(request.parameters)

    # Cleanup previous tasks of same name for this item
    statement = select(ProcessingTask).where(
        ProcessingTask.item_id == request.item_id
    ).where(
        ProcessingTask.name == skill_name
    )
    existing_tasks = session.exec(statement).all()
    for t in existing_tasks:
        session.delete(t)
    # Commit deletion immediately
    session.commit()

    task = ProcessingTask(
        item_id=request.item_id,
        owner_id=item.owner_id,
        name=skill_name,
        status=TaskStatus.PENDING,
        trigger_event="manual",
        parameters=params,
        start_time=datetime.now(timezone.utc)
    )
    
    session.add(task)
    session.commit()
    session.refresh(task)
    
    background_tasks.add_task(execute_task, str(task.id))
    
    return {"message": "Skill triggered", "task_id": task.id}

from typing import Any
import uuid
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlmodel import Session
from datetime import datetime, timezone
import logging

from app.models import get_session, ProcessingTask, TaskStatus
from app.workers import execute_task
from app import crud

router = APIRouter(
    prefix="/tasks",
    tags=["tasks"]
)

logger = logging.getLogger(__name__)

@router.post("/{task_id}/restart")
async def restart_task(
    task_id: uuid.UUID, 
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session)
):
    """
    Restarts a failed task by creating a new one with the same parameters.
    """
    original_task = session.get(ProcessingTask, task_id)
    if not original_task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Clone the task details into a new task
    new_task = ProcessingTask(
        item_id=original_task.item_id,
        owner_id=original_task.owner_id,
        name=original_task.name,
        status=TaskStatus.PENDING,
        trigger_event=original_task.trigger_event,
        parameters=original_task.parameters,
        start_time=datetime.now(timezone.utc)
    )
    
    session.delete(original_task)
    session.add(new_task)
    session.commit()
    session.refresh(new_task)
    
    # Trigger execution in background (or just let the poller pick it up? 
    # execute_task is async, so we can use background tasks to run it immediately to be responsive)
    # The worker poller also runs, but manual restart implies urgency.
    background_tasks.add_task(execute_task, str(new_task.id))
    
    return {"message": "Task restart initiated", "new_task_id": new_task.id}

@router.delete("/{task_id}")
async def delete_task(
    task_id: uuid.UUID,
    session: Session = Depends(get_session)
):
    """
    Deletes a task by its ID.
    """
    task = session.get(ProcessingTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    session.delete(task)
    session.commit()
    return {"message": "Task deleted successfully"}

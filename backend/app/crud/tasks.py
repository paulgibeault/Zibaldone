from typing import Optional
from datetime import datetime
import uuid
from sqlmodel import Session
from app.models import ProcessingTask, TaskStatus

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

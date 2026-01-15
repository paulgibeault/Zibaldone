from typing import Any, List, Optional
import uuid
import json
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlmodel import Session, select
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

    try:
        # Update existing task instead of deleting/recreating to preserve ID and history
        original_task.status = TaskStatus.PENDING
        original_task.start_time = datetime.now(timezone.utc)
        original_task.end_time = None
        original_task.result_json = None
        original_task.message = None
        # We keep the same trigger_event, parameters, etc.
        
        session.add(original_task)
        session.commit()
        session.refresh(original_task)
        
        background_tasks.add_task(execute_task, str(original_task.id))
        
        return {"message": "Task restart initiated", "task_id": original_task.id}
    except Exception as e:
        logger.error(f"Failed to restart task {task_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to restart task: {str(e)}")

import json
from typing import List, Optional

@router.post("/restart-failed")
async def restart_failed_tasks(
    task_ids: Optional[List[uuid.UUID]] = None,
    background_tasks: BackgroundTasks = None, # Make optional to avoid pydantic issues if passed as None in some test contexts, though normally dependency fixes it. 
    session: Session = Depends(get_session)
):
    """
    Restarts failed tasks. 
    If task_ids is provided, only restarts those tasks.
    If task_ids is None, restarts ALL failed tasks (including logically failed ones).
    """
    # 1. Identify tasks to restart
    tasks_to_restart = []
    
    if task_ids:
        # User specified tasks
        tasks = session.exec(select(ProcessingTask).where(ProcessingTask.id.in_(task_ids))).all()
        tasks_to_restart = tasks
    else:
        # Find all failed tasks
        # A. Explicitly FAILED
        explicit_failed = session.exec(select(ProcessingTask).where(ProcessingTask.status == TaskStatus.FAILED)).all()
        tasks_to_restart.extend(explicit_failed)
        
        # B. Logically FAILED (Completed but result says failure)
        # We have to fetch completed tasks and check json (doing this in memory as sqlite JSON query is tricky to make portable)
        # Optimization: Only fetch COMPLETED tasks.
        completed_tasks = session.exec(select(ProcessingTask).where(ProcessingTask.status == TaskStatus.COMPLETED)).all()
        for t in completed_tasks:
            if t.result_json:
                try:
                    res = json.loads(t.result_json)
                    if isinstance(res, dict) and res.get('status') == 'failure':
                        tasks_to_restart.append(t)
                except: pass
                
    restarted_count = 0
    for original_task in tasks_to_restart:
        try:
            # Update existing task logic
            original_task.status = TaskStatus.PENDING
            original_task.start_time = datetime.now(timezone.utc)
            original_task.end_time = None
            original_task.result_json = None
            original_task.message = None
            
            session.add(original_task)
            session.commit()
            session.refresh(original_task)
            
            # Trigger execution
            if background_tasks:
                background_tasks.add_task(execute_task, str(original_task.id))
            else:
                # If background_tasks missing (rare), just let poller handle it or run manually? 
                # Should rely on dependency.
                pass
                
            restarted_count += 1
        except Exception as e:
            logger.error(f"Failed to restart task {original_task.id} in bulk restart: {e}")
            # Continue with other tasks even if one fails
            continue
        
    return {"message": f"Restarted {restarted_count} failed tasks", "count": restarted_count}

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

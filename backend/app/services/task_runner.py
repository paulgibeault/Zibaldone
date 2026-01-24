import asyncio
import json
import logging
import uuid
import traceback
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Session

from app.models import ProcessingTask, TaskStatus
from app import crud
from app.services.event_broadcaster import broadcaster

logger = logging.getLogger(__name__)

class TaskContext:
    """
    Async Context Manager for encapsulating processing tasks.
    Handles existing task retrieval, status updates (RUNNING -> COMPLETED/FAILED),
    timestamps, database commits, and live event broadcasting.
    """
    def __init__(self, session_factory, task_id: uuid.UUID):
        self.session_factory = session_factory
        self.task_id = task_id
        self.session: Optional[Session] = None
        self.task: Optional[ProcessingTask] = None
        self.item_id: Optional[uuid.UUID] = None

    async def __aenter__(self):
        self.session = self.session_factory()
        
        try:
            self.task = self.session.get(ProcessingTask, self.task_id)
            if not self.task:
                raise ValueError(f"Task {self.task_id} not found")
            
            if self.task.status != TaskStatus.PENDING:
                 # Already running or done?
                 # If we are strictly a runner for Pending tasks, this is an abandon.
                 # But maybe we want to be robust. 
                 # For now, let's assume if we are here, we want to run it. 
                 # But if it's already COMPLETED, abort.
                 if self.task.status in [TaskStatus.COMPLETED, TaskStatus.FAILED]:
                      raise ValueError(f"Task {self.task_id} is already in terminal state {self.task.status}")

            self.item_id = self.task.item_id
            
            # Mark RUNNING
            self.task.status = TaskStatus.RUNNING
            self.task.start_time = datetime.now(timezone.utc)
            self.session.add(self.task)
            self.session.commit()
            self.session.refresh(self.task)
            
            # Broadcast start update
            await broadcaster.broadcast(json.dumps({
                "type": "update", 
                "item_id": str(self.item_id)
            }))
            
            logger.info(f"Task Started: {self.task.name} for item {self.item_id}")
            
            # Create SkillContext
            from app.services.skill_sdk import SkillContext
            ctx = SkillContext(self.session, self.task, self.task.item)
            
            return self.session, self.task, ctx
            
        except Exception:
            # If start fails, we should close session
            if self.session:
                self.session.close()
            raise

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if not self.session or not self.task:
            if self.session:
                self.session.close()
            return

        end_time = datetime.now(timezone.utc)
        
        try:
            if exc_type:
                # Exception occurred - mark as FAILED
                # Check for CancelledError
                if exc_type is asyncio.CancelledError:
                    error_message = "Task cancelled by user"
                    logger.info(f"Task Cancelled: {self.task.name}")
                elif exc_type is asyncio.TimeoutError:
                    error_message = "Task timed out"
                    logger.warning(f"Task Timeout: {self.task.name}")
                else:
                    error_message = str(exc_val)
                    logger.error(f"Task Failed: {self.task.name} - {error_message}")
                    if exc_tb:
                        logger.error("".join(traceback.format_tb(exc_tb)))

                self.update_task_status(TaskStatus.FAILED, error_message, end_time)
            
            else:
                # Success - mark as COMPLETED
                # Logic check: Did the caller already set it to FAILED logically?
                # We expect the caller to set result_json. 
                # If existing status is RUNNING, set to COMPLETED.
                # If the caller sets FAILED (like logic error), respect it.
                
                # Refresh to get latest
                self.session.refresh(self.task)
                
                if self.task.status == TaskStatus.RUNNING:
                    logger.info(f"Task Completed: {self.task.name}")
                    self.update_task_status(TaskStatus.COMPLETED, None, end_time)
                
            # Broadcast completion/failure update
            if self.item_id:
                await broadcaster.broadcast(json.dumps({
                    "type": "update", 
                    "item_id": str(self.item_id)
                }))

        finally:
            self.session.close()
            
        # Propagate CancelledError so the runner knows to stop if needed (though usually we just swallow validation errors)
        # But we must propagate CancelledError to ensure proper task teardown in asyncio
        if exc_type is asyncio.CancelledError:
             return False # Propagate
             
        return True # Suppress other exceptions as we handled them by updating DB status

    def update_task_status(self, status, message, end_time):
        try:
            crud.update_task(
                self.session,
                self.task.id,
                status=status,
                message=message,
                end_time=end_time
            )
        except Exception as e:
            logger.error(f"Failed to update task status db: {e}") 

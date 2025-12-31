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
    Handles creation, status updates (RUNNING -> COMPLETED/FAILED),
    timestamps, database commits, and live event broadcasting.
    """
    def __init__(self, session: Session, item_id: uuid.UUID, task_name: str):
        self.session = session
        self.item_id = item_id
        self.task_name = task_name
        self.task: Optional[ProcessingTask] = None

    async def __aenter__(self) -> ProcessingTask:
        try:
            # Create task in RUNNING state
            new_task = ProcessingTask(
                item_id=self.item_id,
                name=self.task_name,
                status=TaskStatus.RUNNING,
                start_time=datetime.now(timezone.utc)
            )
            self.task = crud.create_task(self.session, new_task)
            
            # Broadcast start update
            await broadcaster.broadcast(json.dumps({
                "type": "update", 
                "item_id": str(self.item_id)
            }))
            
            logger.info(f"Task Started: {self.task_name} for item {self.item_id}")
            return self.task
            
        except Exception as e:
            logger.error(f"Failed to start task {self.task_name}: {e}")
            raise

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if not self.task:
            return

        end_time = datetime.now(timezone.utc)
        
        if exc_type:
            # Exception occurred - mark as FAILED
            error_message = str(exc_val)
            logger.error(f"Task Failed: {self.task_name} - {error_message}")
            if exc_tb:
                logger.error("".join(traceback.format_tb(exc_tb)))

            crud.update_task(
                self.session,
                self.task.id,
                status=TaskStatus.FAILED,
                message=error_message,
                end_time=end_time
            )
        else:
            # Success - mark as COMPLETED
            logger.info(f"Task Completed: {self.task_name}")
            crud.update_task(
                self.session,
                self.task.id,
                status=TaskStatus.COMPLETED,
                end_time=end_time
                # Note: result_json should have been set on self.task directly by the caller before exit
            )

        # Broadcast completion/failure update
        await broadcaster.broadcast(json.dumps({
            "type": "update", 
            "item_id": str(self.item_id)
        }))
        
        # Propagate exception so current processing pipeline stops if needed
        # (or handle it?? Usually we want to stop processing if a critical step fails)
        return False 

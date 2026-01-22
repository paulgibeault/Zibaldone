
import pytest
import asyncio
import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
from sqlmodel import Session, select

from app.models import ProcessingTask, TaskStatus
import app.workers as workers
from app.api.endpoints.tasks import delete_task

@pytest.mark.asyncio
async def test_deletion_unblocks_queue(session: Session, monkeypatch):
    """
    Simulates the scenario where a running task is deleted.
    Verifies that the deletion cancels the running task, allowing the next task to start.
    """
    # 1. Setup Mock Engine for workers
    monkeypatch.setattr(workers, "engine", session.bind)
    
    # 2. Mock 'execute_task' to simulate a long running task
    # We use a signal to know when it's running
    task_running_event = asyncio.Event()
    cancel_event = asyncio.Event()
    
    async def mock_execution(task_id):
        workers._running_tasks[str(task_id)] = asyncio.current_task()
        task_running_event.set()
        try:
            # Simulate long work
            await asyncio.sleep(5) 
        except asyncio.CancelledError:
            cancel_event.set()
            raise
        finally:
             if str(task_id) in workers._running_tasks:
                 del workers._running_tasks[str(task_id)]

    # 3. Create Tasks
    task1 = ProcessingTask(id=uuid.uuid4(), item_id=uuid.uuid4(), name="Long Task", status=TaskStatus.PENDING)
    task2 = ProcessingTask(id=uuid.uuid4(), item_id=uuid.uuid4(), name="Pending Task", status=TaskStatus.PENDING)
    session.add(task1)
    session.add(task2)
    session.commit()
    session.refresh(task1)

    # 4. Start the worker loop in background (simulated)
    # We'll just run process_task_queue logic manually for control
    
    # Start Task 1
    # We patch execute_task to use our mock
    with patch("app.workers.execute_task", side_effect=mock_execution):
         # Create a background task for the worker processing
         worker_future = asyncio.create_task(workers.execute_task(str(task1.id)))
         
         # Wait until it's running
         await asyncio.wait_for(task_running_event.wait(), timeout=1.0)
         assert str(task1.id) in workers._running_tasks
         
         # SIMULATE DB UPDATE: The real worker updates status to RUNNING
         # We must do this or delete_task won't try to cancel it
         task1_ref = session.get(ProcessingTask, task1.id)
         task1_ref.status = TaskStatus.RUNNING
         session.add(task1_ref)
         session.commit()
         session.refresh(task1_ref)
         
         # 5. Delete Task 1 via API
         # This should trigger cancellation
         # We need to call the delete_task endpoint function directly
         await delete_task(task_id=task1.id, session=session)
         
         # 6. Verify Task 1 was cancelled
         try:
            await asyncio.wait_for(cancel_event.wait(), timeout=2.0)
         except asyncio.TimeoutError:
             pytest.fail("Task was not cancelled after deletion!")
             
         # 7. Verify Task 1 is gone from DB
         db_task = session.get(ProcessingTask, task1.id)
         assert db_task is None
         
         # 8. Verify worker would be free (Task 1 finished/cancelled)
         # In a real loop, it would loop and pick up Task 2.
         # Here ensuring the future finished (cancelled) is enough proving unblock.
         with pytest.raises(asyncio.CancelledError):
             await worker_future

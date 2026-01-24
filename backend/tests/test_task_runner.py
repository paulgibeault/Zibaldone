
import pytest
import json
import uuid
from sqlmodel import Session, select
from app.services.task_runner import TaskContext
from app.models import ProcessingTask, TaskStatus, ContentItem
from unittest.mock import MagicMock

# Note: mock_broadcaster fixture is automatically used if we add it as argument, 
# but TaskContext imports 'broadcaster' directly. 
# Our fixture in conftest.py patches 'app.services.event_broadcaster.broadcaster'.

@pytest.mark.asyncio
async def test_task_context_success(session: Session, mock_broadcaster):
    item_id = uuid.uuid4()
    task_name = "Test Task"

    # Create Task first (PENDING)
    task = ProcessingTask(
        item_id=item_id,
        name=task_name,
        status=TaskStatus.PENDING
    )
    session.add(task)
    session.commit()
    session.refresh(task)

    # Create TaskContext with session factory
    # We use a factory that returns the same session for the test (mocking factory behavior)
    # But TaskContext calls session.close(), so we should probably mock that out or use a real factory if we want to be strict.
    # For testing simpler: we can just let it close it, as long as we don't reuse it.
    # But `session` fixture is function scoped. 
    # Let's define a factory that returns a NEW session if possible, or just the current one but prevents closing?
    # Actually, the simplest way is to mock `session_factory` to return the fixture session,
    # and mock `session.close` to do nothing so the fixture teardown handles it.
    
    session.close = lambda: None # Mock close
    session_factory = lambda: session

    async with TaskContext(session_factory, task.id) as (s, t, ctx):
        assert t.status == TaskStatus.RUNNING
        assert t.start_time is not None
        
        # Simulate work
        t.result_json = json.dumps({"status": "success"})

    # Checks after exit
    session.refresh(task)
    assert task.status == TaskStatus.COMPLETED
    assert task.end_time is not None

@pytest.mark.asyncio
async def test_task_context_failure(session: Session, mock_broadcaster):
    item_id = uuid.uuid4()
    task_name = "Failing Task"

    task = ProcessingTask(
        item_id=item_id,
        name=task_name,
        status=TaskStatus.PENDING
    )
    session.add(task)
    session.commit()
    session.refresh(task)

    session.close = lambda: None
    session_factory = lambda: session

    async with TaskContext(session_factory, task.id) as (s, t, ctx):
        assert t.status == TaskStatus.RUNNING
        raise ValueError("Something went wrong")

    session.refresh(task)
    assert task.status == TaskStatus.FAILED
    assert "Something went wrong" in task.message
    assert task.end_time is not None

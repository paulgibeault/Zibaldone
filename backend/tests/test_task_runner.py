
import pytest
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
    
    # Create TaskContext
    async with TaskContext(session, item_id, task_name) as task:
        assert task.item_id == item_id
        assert task.name == task_name
        assert task.status == TaskStatus.RUNNING
        assert task.start_time is not None
        assert task.end_time is None
        
        # Verify it's in DB
        db_task = session.get(ProcessingTask, task.id)
        assert db_task is not None
        assert db_task.status == TaskStatus.RUNNING

        # Simulate some work
        task.result_json = '{"success": true}'
        session.add(task)

    # After exit
    db_task = session.get(ProcessingTask, task.id)
    assert db_task.status == TaskStatus.COMPLETED
    assert db_task.end_time is not None
    assert db_task.result_json == '{"success": true}'

@pytest.mark.asyncio
async def test_task_context_failure(session: Session, mock_broadcaster):
    item_id = uuid.uuid4()
    task_name = "Failing Task"
    
    with pytest.raises(ValueError, match="Something went wrong"):
        async with TaskContext(session, item_id, task_name) as task:
            raise ValueError("Something went wrong")

    # After exit (exception raised)
    # Since we can't get the task object easily if it crashed, we query by item_id
    statement = select(ProcessingTask).where(ProcessingTask.item_id == item_id)
    tasks = session.exec(statement).all()
    assert len(tasks) == 1
    db_task = tasks[0]
    
    assert db_task.name == task_name
    assert db_task.status == TaskStatus.FAILED
    assert db_task.message == "Something went wrong"
    assert db_task.end_time is not None

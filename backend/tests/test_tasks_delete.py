
import pytest
from app.models import ProcessingTask, TaskStatus
from sqlmodel import Session, select
import uuid
from datetime import datetime, timezone

def test_delete_task(client, session: Session):
    # 1. Create a dummy task
    task = ProcessingTask(
        id=uuid.uuid4(),
        item_id=uuid.uuid4(),
        owner_id=uuid.uuid4(),
        name="Test Task to Delete",
        status=TaskStatus.COMPLETED,
        start_time=datetime.now(timezone.utc)
    )
    session.add(task)
    session.commit()
    session.refresh(task)
    
    task_id = str(task.id)
    
    # 2. Verify it exists
    response = client.get(f"/api/tasks/{task_id}/restart") # restart endpoint exists, but we want to check existence generally via DB or side effect
    # simpler: just check DB directly which we did by refreshing.
    # but let's check it's deletable via API.
    
    # 3. Delete the task
    response = client.delete(f"/api/tasks/{task_id}")
    assert response.status_code == 200
    assert response.json() == {"message": "Task deleted successfully"}
    
    # 4. Verify it is gone
    deleted_task = session.get(ProcessingTask, task.id)
    assert deleted_task is None

def test_delete_nonexistent_task(client):
    random_id = uuid.uuid4()
    response = client.delete(f"/api/tasks/{random_id}")
    assert response.status_code == 404


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

def test_restart_task(client, session: Session):
    # 1. Create a dummy task (FAILED status)
    task = ProcessingTask(
        id=uuid.uuid4(),
        item_id=uuid.uuid4(),
        owner_id=uuid.uuid4(),
        name="Test Task to Restart",
        status=TaskStatus.FAILED,
        start_time=datetime.now(timezone.utc),
        end_time=datetime.now(timezone.utc)
    )
    session.add(task)
    session.commit()
    session.refresh(task)
    
    task_id = str(task.id)
    
    # 2. Restart the task
    # Note: restart endpoint uses BackgroundTasks. In tests, Starlette's TestClient
    # usually handles this or we mock it. For integration test, we just check response 
    # and status update to PENDING.
    response = client.post(f"/api/tasks/{task_id}/restart")
    assert response.status_code == 200
    assert response.json()["message"] == "Task restart initiated"
    
    # 3. Verify status changed to PENDING
    session.refresh(task)
    assert task.status == TaskStatus.PENDING
    assert task.end_time is None


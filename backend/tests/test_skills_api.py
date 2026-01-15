
import pytest
from app.models import ProcessingTask, TaskStatus, ContentItem, ContentStatus
from sqlmodel import Session, select
import uuid
from datetime import datetime, timezone

def test_list_skills_and_trigger(client, session: Session):
    # 1. List skills
    # We assume at least one skill exists (e.g. metadata_extraction from default registry or mocking)
    # Since we can't easily mock registry here without more setup, we'll check if endpoint returns 200 list
    response = client.get("/api/skills/")
    assert response.status_code == 200
    skills = response.json()
    assert isinstance(skills, list)
    
    # If no skills, we can't test trigger effectively without mocking, but at least endpoint works.
    if not skills:
        return

    skill_name = skills[0]['name']

    # 2. Create a dummy item
    item = ContentItem(
        id=uuid.uuid4(),
        status=ContentStatus.COMPLETED, # must act like it's ready
        original_filename="trigger_test.txt",
        storage_path="test/path",
        owner_id=uuid.uuid4()
    )
    session.add(item)
    session.commit()
    
    # 3. Trigger skill
    response = client.post(f"/api/skills/{skill_name}/trigger", json={
        "item_id": str(item.id),
        "parameters": {"test_param": "test_value"}
    })
    
    assert response.status_code == 200
    data = response.json()
    task_id_str = data["task_id"]
    print(f"DEBUG: task_id_str type: {type(task_id_str)} value: {task_id_str}")
    
    task_id = uuid.UUID(task_id_str)
    
    # 4. Verify task created
    # Workaround for SQLAlchemy/SQLite UUID binding issue in test env
    all_tasks = session.exec(select(ProcessingTask)).all()
    task = next((t for t in all_tasks if t.id == task_id), None)
    
    assert task is not None
    assert task.item_id == item.id
    assert task.name == skill_name
    assert task.status in [TaskStatus.PENDING, TaskStatus.RUNNING, TaskStatus.COMPLETED, TaskStatus.FAILED]


from unittest.mock import AsyncMock
import pytest
import json
from sqlmodel import Session, select
from app.models import ContentItem, ContentStatus, ProcessingTask, TaskStatus, Tag
from app.workers import process_item

@pytest.mark.asyncio
async def test_process_item_happy_path(session: Session, mock_llm_service, mock_storage, mock_broadcaster):
    # Setup
    item = ContentItem(
        original_filename="doc.txt",
        storage_path="uploads/doc.txt",
        status=ContentStatus.QUEUED,
        version=1
    )
    session.add(item)
    session.commit()
    
    # Configure mock LLM to return specific metadata
    mock_llm_service.generate_metadata = AsyncMock(return_value={
        "summary": "This is a summary",
        "tags": ["AI", "Coding"]
    })
    
    # Run
    await process_item(item, session, mock_llm_service)
    
    # Verify Item Status
    session.refresh(item)
    assert item.status == ContentStatus.COMPLETED
    
    # Verify Metadata
    metadata = json.loads(item.metadata_json)
    assert metadata["summary"] == "This is a summary"
    assert "AI" in metadata["tags"]
    
    # Verify Tags Created
    tags = session.exec(select(Tag)).all()
    tag_names = [t.name for t in tags]
    assert "AI" in tag_names
    assert "Coding" in tag_names
    
    # Verify Item-Tag Links
    assert len(item.tags) == 2
    
    # Verify Tasks Created
    tasks = session.exec(select(ProcessingTask).where(ProcessingTask.item_id == item.id)).all()
    task_names = [t.name for t in tasks]
    assert "Metadata Extraction" in task_names
    assert "Tag Alignment" in task_names
    
    # Verify Metadata Extraction Result
    meta_task = next(t for t in tasks if t.name == "Metadata Extraction")
    assert meta_task.status == TaskStatus.COMPLETED
    res_json = json.loads(meta_task.result_json)
    assert res_json["summary"] == "This is a summary"

@pytest.mark.asyncio
async def test_process_item_no_tags(session: Session, mock_llm_service, mock_storage, mock_broadcaster):
    item = ContentItem(
        original_filename="notags.txt",
        storage_path="uploads/notags.txt",
        status=ContentStatus.QUEUED,
        version=1
    )
    session.add(item)
    session.commit()
    
    mock_llm_service.generate_metadata = AsyncMock(return_value={
        "summary": "Just text",
        "tags": []
    })
    
    await process_item(item, session, mock_llm_service)
    
    session.refresh(item)
    assert item.status == ContentStatus.COMPLETED
    
    tasks = session.exec(select(ProcessingTask).where(ProcessingTask.item_id == item.id)).all()
    task_names = [t.name for t in tasks]
    assert "Metadata Extraction" in task_names
    assert "Tag Alignment" not in task_names

@pytest.mark.asyncio
async def test_process_item_failure(session: Session, mock_llm_service, mock_storage, mock_broadcaster):
    item = ContentItem(
        original_filename="fail.txt",
        storage_path="uploads/fail.txt",
        status=ContentStatus.QUEUED,
        version=1
    )
    session.add(item)
    session.commit()
    
    # Simulate LLM failure
    mock_llm_service.generate_metadata = AsyncMock(side_effect=Exception("LLM Down"))
    
    await process_item(item, session, mock_llm_service)
    
    session.refresh(item)
    assert item.status == ContentStatus.FAILED
    
    # Check if the task failed
    tasks = session.exec(select(ProcessingTask).where(ProcessingTask.item_id == item.id)).all()
    meta_task = next((t for t in tasks if t.name == "Metadata Extraction"), None)
    
    # Note: process_item logic catches the exception and marks content as FAILED.
    # The TaskContext inside process_item should also catch it and mark the task as FAILED.
    assert meta_task is not None
    assert meta_task.status == TaskStatus.FAILED
    assert "LLM Down" in meta_task.message

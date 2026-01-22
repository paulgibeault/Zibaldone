
import pytest
import asyncio
from app.workers import pause_processing, resume_processing, process_task_queue, process_unprocessed_items, process_queued_items, _is_paused
from app.models import ProcessingTask, TaskStatus, ContentItem, ContentStatus
from sqlmodel import Session, select
import uuid
from datetime import datetime, timezone

# Mock execute_task to avoid actual execution overhead/skills, 
# we just want to see if the loop picks it up.
from unittest.mock import patch

@pytest.mark.asyncio
async def test_resume_picks_up_pending_tasks(session: Session, monkeypatch):
    # Patch the engine used by workers to be our test engine
    from app.models import engine as prod_engine
    from tests.conftest import engine as test_engine
    import app.workers
    
    # We need to ensure app.workers uses the same engine as our session
    # Since session fixture created tables on test_engine.
    # We can patch 'app.workers.engine'
    monkeypatch.setattr(app.workers, "engine", session.bind) 
    
    # 1. Start in PAUSED state
    pause_processing()
    from app.workers import get_processing_status
    assert get_processing_status() == "paused"
    
    # 2. Create a PENDING task
    task = ProcessingTask(
        id=uuid.uuid4(),
        item_id=uuid.uuid4(),
        owner_id=uuid.uuid4(),
        name="Test Resume Task",
        status=TaskStatus.PENDING,
        start_time=None
    )
    session.add(task)
    session.commit()
    session.refresh(task)
    
    # 3. Verify it is NOT picked up while paused
    # We can run process_task_queue() once manually.
    # It should exit immediately or skip tasks.
    
    with patch("app.workers.execute_task") as mock_execute:
        await process_task_queue()
        mock_execute.assert_not_called()
        
    # 4. Resume
    resume_processing()
    assert get_processing_status() == "running"
    
    # 5. Run process loop again
    with patch("app.workers.execute_task", new_callable=lambda: asyncio.Future) as mock_execute:
        # We need to mock it as an async function if we await it? 
        # Actually execute_task is async. 
        # But we want to mock it so it doesn't actually run, just verifies call.
        
        # Simpler: Let's use a real call but mock the skill execution inside?
        # Or just trust the mock.
        pass

    # Let's try running the actual process_task_queue with a mocked execute_task
    # to confirm it calls it.
    with patch("app.workers.execute_task") as mock_exec:
        # Mock must be async-able
        f = asyncio.Future()
        f.set_result(None)
        mock_exec.return_value = f
        
        await process_task_queue()
        
        # Verify it WAS called
        assert mock_exec.called
        assert mock_exec.call_count >= 1
        args = mock_exec.call_args[0]
        assert str(args[0]) == str(task.id)

@pytest.mark.asyncio
async def test_resume_picks_up_queued_items(session: Session, monkeypatch):
    # Patch engine
    from app.models import engine as prod_engine
    import app.workers
    monkeypatch.setattr(app.workers, "engine", session.bind)
    
    # 1. Start in PAUSED state
    pause_processing()
    
    # 2. Create a QUEUED item
    item = ContentItem(
        id=uuid.uuid4(),
        original_filename="test_file.txt",
        storage_path="/tmp/test_file.txt",
        status=ContentStatus.QUEUED,
        created_at=datetime.now(timezone.utc)
    )
    session.add(item)
    session.commit()
    session.refresh(item)
    
    # 3. Verify NOT picked up when paused
    # Note: process_unprocessed_items skips calls if paused.
    # But checking process_queued_items directly:
    with patch("app.workers.handle_event") as mock_event:
         # Even if called directly, it should break immediately if paused logic is inside?
         # Wait, process_unprocessed_items has the 'if paused: pass' check.
         # process_queued_items ALSO has 'if paused: break' check inside loop.
         # So calling it directly should simulate the 'race' or just check inner logic.
         await process_queued_items()
         # Should not process anything
         mock_event.assert_not_called()
         
    # 4. Resume
    resume_processing()
    
    # 5. Verify picked up
    with patch("app.workers.handle_event") as mock_event:
        # We need to mock file detection too or it will fail
        with patch("app.services.file_detection.file_detector.detect") as mock_detect:
            mock_detect.return_value = {"mime_type": "text/plain"}
            
            await process_queued_items()
            
            # Should have processed it
            session.refresh(item)
            assert item.status == ContentStatus.COMPLETED
            mock_event.assert_called()


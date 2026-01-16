
import sys
import os
import asyncio
import uuid
from datetime import datetime
from sqlmodel import Session, select

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.models import engine, ProcessingTask, TaskStatus, ContentItem
from app.workers import cleanup_stuck_tasks

async def verify_cleanup():
    # 1. Setup: Create a stuck Running task
    with Session(engine) as session:
        # Find or create an item
        item = session.exec(select(ContentItem)).first()
        if not item:
            # Create dummy item
            item = ContentItem(original_filename="dummy.txt", storage_path="/tmp/dummy")
            session.add(item)
            session.commit()
            session.refresh(item)

        task = ProcessingTask(
            item_id=item.id,
            name="Stuck Task",
            status=TaskStatus.RUNNING, # Simulate stuck state
            start_time=datetime.now()
        )
        session.add(task)
        session.commit()
        session.refresh(task)
        task_id = task.id
        print(f"Created stuck task {task_id} with status {task.status}")

    # 2. Run Cleanup
    print("Running cleanup_stuck_tasks()...")
    await cleanup_stuck_tasks()

    # 3. Verify
    with Session(engine) as session:
        task = session.get(ProcessingTask, task_id)
        print(f"Task {task_id} status is now: {task.status}")
        
        if task.status == TaskStatus.FAILED and task.message == "Task interrupted by system restart":
            print("SUCCESS: Task was correctly marked as FAILED.")
        else:
            print(f"FAILURE: Task status is {task.status}, message: {task.message}")

if __name__ == "__main__":
    asyncio.run(verify_cleanup())

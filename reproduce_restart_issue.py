
import sys
import os
import asyncio
import uuid
from datetime import datetime
# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from sqlmodel import Session, select
from app.models import engine, ProcessingTask, TaskStatus, ContentItem

async def test_restart():
    # Ensure tables exist (if not connecting to running DB, this might be needed, but assuming DB exists)
    
    with Session(engine) as session:
        # 1. Create a dummy task
        item = session.exec(select(ContentItem)).first()
        if not item:
            print("No ContentItem found to attach task to.")
            # Create one if needed
            item = ContentItem(
                original_filename="test_file.txt",
                storage_path="/tmp/test_file.txt"
            )
            session.add(item)
            session.commit()
            session.refresh(item)
            print("Created test item.")

        task = ProcessingTask(
            item_id=item.id,
            name="Test Task",
            status=TaskStatus.FAILED,
            parameters={"test": "data"}
        )
        session.add(task)
        session.commit()
        session.refresh(task)
        print(f"Created task {task.id}")
        
        task_id = task.id

    # 2. Simulate the restart logic
    print("Attempting to restart...")
    try:
        with Session(engine) as session:
            # Re-fetch logic
            original_task = session.get(ProcessingTask, task_id)
            if not original_task:
                print("Task not found for restart!")
                return
                
            new_task = ProcessingTask(
                item_id=original_task.item_id,
                owner_id=original_task.owner_id,
                name=original_task.name,
                status=TaskStatus.PENDING,
                trigger_event=original_task.trigger_event,
                parameters=original_task.parameters
            )
            
            session.delete(original_task)
            session.add(new_task)
            session.commit()
            print(f"Restart successful. New task ID: {new_task.id}")
            
    except Exception as e:
        print(f"Restart failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_restart())

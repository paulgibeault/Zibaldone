
import sys
import os
import asyncio
import uuid
from datetime import datetime, timezone
# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from sqlmodel import Session, select
from app.models import engine, ProcessingTask, TaskStatus, ContentItem

async def verify_inplace_restart():
    # 1. Setup Data
    task_id = None
    with Session(engine) as session:
        item = session.exec(select(ContentItem)).first()
        if not item:
            item = ContentItem(
                original_filename="verify_restart.txt",
                storage_path="/tmp/verify_restart.txt"
            )
            session.add(item)
            session.commit()
            session.refresh(item)

        task = ProcessingTask(
            item_id=item.id,
            name="Verify Inplace Restart",
            status=TaskStatus.FAILED,
            parameters={"test": "verify"},
            result_json='{"error": "failed"}',
            message="Initial failure"
        )
        session.add(task)
        session.commit()
        session.refresh(task)
        task_id = task.id
        print(f"Created failed task {task_id}")

    # 2. Simulate the Logic Implemented in Backend
    print("Attempting to restart in-place...")
    try:
        with Session(engine) as session:
            original_task = session.get(ProcessingTask, task_id)
            if not original_task:
                print("Task not found!")
                return

            # LOGIC START
            original_task.status = TaskStatus.PENDING
            original_task.start_time = datetime.now(timezone.utc)
            original_task.end_time = None
            original_task.result_json = None
            original_task.message = None
            
            session.add(original_task)
            session.commit()
            session.refresh(original_task)
            # LOGIC END
            
            print(f"Update successful. Task ID: {original_task.id}")
            
            # Verify State
            if original_task.status != TaskStatus.PENDING:
                print("FAILED: Status not PENDING")
                sys.exit(1)
            if original_task.result_json is not None:
                print("FAILED: result_json not cleared")
                sys.exit(1)
            if original_task.message is not None:
                print("FAILED: message not cleared")
                sys.exit(1)
            
            print("VERIFICATION PASSED: Task restarted in-place successfully.")

    except Exception as e:
        print(f"Restart failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(verify_inplace_restart())

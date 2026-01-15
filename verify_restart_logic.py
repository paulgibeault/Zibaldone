
import sys
import os
import asyncio
import uuid
from datetime import datetime, timezone
import json

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from sqlmodel import Session, select
from app.models import engine, ProcessingTask, TaskStatus, ContentItem
# Import the endpoint logic (simulated call)
from app.api.endpoints.tasks import restart_failed_tasks

async def verify_logic():
    print("Setting up test data...")
    with Session(engine) as session:
        # 1. Create content item
        item = session.exec(select(ContentItem).where(ContentItem.original_filename == "verify_logic.txt")).first()
        if not item:
            item = ContentItem(original_filename="verify_logic.txt", storage_path="/tmp/verify.txt")
            session.add(item)
            session.commit()
            session.refresh(item)
            
        # 2. Create Explicit Failure
        task_fail = ProcessingTask(
            item_id=item.id, name="Explicit Fail", status=TaskStatus.FAILED, parameters={}
        )
        session.add(task_fail)
        
        # 3. Create Logical Failure (Completed but error result)
        task_logic = ProcessingTask(
            item_id=item.id, name="Logical Fail", status=TaskStatus.COMPLETED, 
            result_json=json.dumps({"status": "failure", "message": "Hidden error"}),
            parameters={}
        )
        session.add(task_logic)
        
        # 4. Create Success
        task_ok = ProcessingTask(
            item_id=item.id, name="Success", status=TaskStatus.COMPLETED,
            result_json=json.dumps({"status": "success"}),
            parameters={}
        )
        session.add(task_ok)
        session.commit()
        session.refresh(task_fail)
        session.refresh(task_logic)
        session.refresh(task_ok)
        
        print(f"Created Tasks: Explicit={task_fail.id}, Logical={task_logic.id}, Success={task_ok.id}")
        
    print("\n--- TEST 1: Restart specific ID (Logical Failure) ---")
    # Should work now
    res = await restart_failed_tasks(task_ids=[task_logic.id], session=Session(engine))
    print(f"Result: {res}")
    
    with Session(engine) as session:
        t = session.get(ProcessingTask, task_logic.id)
        if t.status == TaskStatus.PENDING:
            print("PASS: Logical failure task restarted successfully.")
        else:
            print(f"FAIL: Task status is {t.status}")

    print("\n--- TEST 2: Restart ALL (Bulk) ---")
    # Reset
    with Session(engine) as session:
        t = session.get(ProcessingTask, task_logic.id)
        t.status = TaskStatus.COMPLETED
        t.result_json = json.dumps({"status": "failure"}) # Re-fail it
        session.add(t)
        session.commit()
        
    # Call with no IDs -> Should pick up explicit AND logical
    res = await restart_failed_tasks(task_ids=None, session=Session(engine))
    print(f"Result: {res}")
    
    with Session(engine) as session:
        t_fail = session.get(ProcessingTask, task_fail.id)
        t_logic = session.get(ProcessingTask, task_logic.id)
        t_ok = session.get(ProcessingTask, task_ok.id)
        
        if t_fail.status == TaskStatus.PENDING and t_logic.status == TaskStatus.PENDING:
            print("PASS: Both failure types picked up.")
        else:
            print(f"FAIL: Explicit={t_fail.status}, Logical={t_logic.status}")
            
        if t_ok.status == TaskStatus.COMPLETED:
             print("PASS: Success task left alone.")
        else:
             print("FAIL: Success task was restarted!")

if __name__ == "__main__":
    asyncio.run(verify_logic())

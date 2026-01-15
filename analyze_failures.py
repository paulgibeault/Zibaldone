import sys
import os
import asyncio
from typing import List, Dict, Any

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from sqlmodel import Session, select, func
from app.models import engine, ProcessingTask, TaskStatus, ContentItem, ContentStatus

async def analyze_failures():
    with Session(engine) as session:
        # 1. Count Failed Tasks
        failed_tasks_count = session.exec(select(func.count(ProcessingTask.id)).where(ProcessingTask.status == TaskStatus.FAILED)).one()
        print(f"Failed Tasks Count: {failed_tasks_count}")

        # 2. Count Failed Items
        failed_items_count = session.exec(select(func.count(ContentItem.id)).where(ContentItem.status == ContentStatus.FAILED)).one()
        print(f"Failed Content Items Count: {failed_items_count}")
        
        # 3. List Failed Tasks Breakdown
        failed_tasks = session.exec(select(ProcessingTask).where(ProcessingTask.status == TaskStatus.FAILED)).all()
        print("\n--- Failed Tasks Details ---")
        for t in failed_tasks:
            print(f"Task {t.id} | Name: {t.name} | Item: {t.item_id}")

        # 4. List Failed Items Breakdown
        failed_items = session.exec(select(ContentItem).where(ContentItem.status == ContentStatus.FAILED)).all()
        print("\n--- Failed Items Details ---")
        for i in failed_items:
            # Check if it has failed tasks
            has_failed_tasks = any(t.status == TaskStatus.FAILED for t in i.tasks)
            print(f"Item {i.id} | Original: {i.original_filename} | Has Failed Tasks: {has_failed_tasks}")

        # 5. Check for Items that are NOT Failed but have Failed Tasks
        # (This is the most likely case for "I see lots of red in UI but count is low" if UI shows item status based on tasks)
        # Actually user said "count of failed tasks... is 2".
        
        # 6. Check for "Stuck" tasks?
        stuck_tasks = session.exec(select(ProcessingTask).where(ProcessingTask.status == TaskStatus.RUNNING)).all()
        print(f"\nRUNNING Tasks Count: {len(stuck_tasks)}")

        pending_tasks = session.exec(select(ProcessingTask).where(ProcessingTask.status == TaskStatus.PENDING)).all()
        print(f"PENDING Tasks Count: {len(pending_tasks)}")

        queued_items = session.exec(select(ContentItem).where(ContentItem.status == ContentStatus.QUEUED)).all()
        print(f"QUEUED Items Count: {len(queued_items)}")
        
        processing_items = session.exec(select(ContentItem).where(ContentItem.status == ContentStatus.PROCESSING)).all()
        print(f"PROCESSING Items Count: {len(processing_items)}")

        # 7. Check for COMPLETED tasks that are logically FAILED
        import json
        completed_tasks = session.exec(select(ProcessingTask).where(ProcessingTask.status == TaskStatus.COMPLETED)).all()
        logical_failed_count = 0
        for t in completed_tasks:
            if t.result_json:
                try:
                    res = json.loads(t.result_json)
                    if isinstance(res, dict) and res.get('status') == 'failure':
                        logical_failed_count += 1
                        print(f"Logically Failed Task: {t.id} | Name: {t.name}")
                except:
                    pass
        print(f"Logically Failed Tasks (Status=COMPLETED): {logical_failed_count}")


if __name__ == "__main__":
    asyncio.run(analyze_failures())

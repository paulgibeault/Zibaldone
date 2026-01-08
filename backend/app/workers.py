import asyncio
import logging
import json
import traceback
from datetime import datetime, timezone
from typing import Dict, Any, List

from sqlmodel import Session, select
from app.models import (
    engine, 
    ContentItem, 
    ContentStatus, 
    ProcessingTask, 
    TaskStatus, 
    User,
    Tag
)
from app import crud
from app.services.skill_registry import skill_registry
from app.services.skill_sdk import SkillContext
from app.services.event_broadcaster import broadcaster
from app.services.storage import get_storage

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Skills
skill_registry.load_skills()

async def handle_event(session: Session, event: str, item_id: Any, context_data: Dict[str, Any] = None):
    """
    Finds skills triggered by event and creates PENDING tasks.
    Broadcasting events is also handled here if needed (system wide events).
    """
    logger.info(f"Event detected: {event} for item {item_id}")
    
    # 1. Broadcast to UI
    try:
        await broadcaster.broadcast(json.dumps({
            "type": "event",
            "event": event,
            "item_id": str(item_id)
        }))
    except Exception as e:
        logger.warning(f"Failed to broadcast event: {e}")

    # 2. Trigger Skills
    skills = skill_registry.get_skills_for_trigger(event)
    for skill_config in skills:
        # Check if we should deduct from context_data or defaults
        params = {}
        for k, v in skill_config.parameters.items():
            params[k] = v.default
            
        task = ProcessingTask(
            item_id=item_id,
            name=skill_config.name,
            status=TaskStatus.PENDING,
            trigger_event=event,
            parameters=params
        )
        session.add(task)
        logger.info(f"Scheduled task: {skill_config.name} for item {item_id}")
    
    session.commit()
    
    # Notify UI of new task
    try:
        await broadcaster.broadcast(json.dumps({
            "type": "update",
            "item_id": str(item_id)
        }))
    except:
        pass

async def process_queued_items():
    """
    Polls content items in QUEUED state.
    Triggers 'file_created' event.
    """
    # Use a separate session for polling
    item_ids = []
    with Session(engine) as session:
        statement = select(ContentItem.id).where(ContentItem.status == ContentStatus.QUEUED)
        item_ids = session.exec(statement).all()
        logger.info(f"Worker polling: Found {len(item_ids)} queued items.")
    
    # Process outside the polling session
    for item_id in item_ids:
        try:
            with Session(engine) as session:
                item = session.get(ContentItem, item_id)
                if not item or item.status != ContentStatus.QUEUED:
                    continue
                    
                logger.info(f"Picked up queued item: {item.original_filename}")
                
                # Update status to COMPLETED (meaning "Ingested into system")
                item.status = ContentStatus.COMPLETED 
                session.add(item)
                session.commit()
                
                # Trigger 'file_created'
                await handle_event(session, "file_created", item.id)
                
        except Exception as e:
            logger.error(f"Error processing queued item {item_id}: {e}", exc_info=True)
            try:
                with Session(engine) as error_session:
                    i = error_session.get(ContentItem, item_id)
                    if i:
                        i.status = ContentStatus.FAILED
                        error_session.add(i)
                        error_session.commit()
            except:
                pass

async def execute_task(task_id: str):
    """
    Executes a single task by ID.
    """
    with Session(engine) as session:
        task = session.get(ProcessingTask, task_id)
        if not task or task.status != TaskStatus.PENDING:
            return

        # Lock / Set RUNNING
        task.status = TaskStatus.RUNNING
        task.start_time = datetime.now(timezone.utc)
        session.add(task)
        session.commit()
        
        # Notify start
        try:
            await broadcaster.broadcast(json.dumps({"type": "update", "item_id": str(task.item_id)}))
        except: pass

        try:
            item = task.item
            ctx = SkillContext(session, task, item)
            
            logger.info(f"Executing Skill {task.name} for item {item.id}")
            result = await skill_registry.execute_skill(task.name, ctx)
            
            # 1. Update Metadata
            if result.tags_to_add:
                 for tag_name in result.tags_to_add:
                     # Check if tag exists for this user
                     statement = select(Tag).where(Tag.name == tag_name).where(Tag.owner_id == item.owner_id)
                     tag = session.exec(statement).first()
                     if not tag:
                         # Create unapproved tag owned by these user
                         tag = Tag(
                            name=tag_name, 
                            owner_id=item.owner_id,
                            is_autocreated=True,
                            is_approved=False
                         )
                         session.add(tag)
                     
                     if tag not in item.tags:
                         item.tags.append(tag)
                         session.add(item)

            if result.metadata_patch:
                current = item.item_metadata.copy() if item.item_metadata else {}
                current.update(result.metadata_patch)
                
                # Add Provenance info
                prov = current.get('provenance', {})
                prov['last_task'] = str(task.id) # simple tracking
                current['provenance'] = prov
                
                item.item_metadata = current
                session.add(item)

            # 2. Update Content (Versioning) - Placeholder
            if result.new_version_created and result.new_content:
                logger.info("New version creation requested - Not yet implemented fully")
                # TODO: Implement full versioning logic

            # 3. Finalize Task
            task.status = TaskStatus.COMPLETED
            task.end_time = datetime.now(timezone.utc)
            # Use model_dump_json for Pydantic v2
            if hasattr(result, 'model_dump_json'):
                task.result_json = result.model_dump_json()
            else:
                task.result_json = result.json() 
                
            session.add(task)
            session.commit()
            
            # 4. Emit Events (AFTER commit to ensure data is visible)
            for evt in result.events_to_emit:
                # We need to trigger these events.
                await handle_event(session, evt, item.id)

        except Exception as e:
            logger.error(f"Task {task.id} failed: {e}", exc_info=True)
            task.status = TaskStatus.FAILED
            task.message = str(e)
            task.end_time = datetime.now(timezone.utc)
            session.add(task)
            session.commit()
            
        # Notify end
        try:
            await broadcaster.broadcast(json.dumps({"type": "update", "item_id": str(task.item_id)}))
        except: pass


async def process_task_queue():
    """
    Polls for PENDING tasks and runs them.
    """
    # Use a separate session for polling
    with Session(engine) as session:
        statement = select(ProcessingTask.id).where(ProcessingTask.status == TaskStatus.PENDING)
        task_ids = session.exec(statement).all()
        
    for task_id in task_ids:
        # Run sequentially for now
        await execute_task(task_id)


async def process_unprocessed_items():
    """
    Main worker entry point.
    Renamed loops but keeping this function name for main.py compatibility.
    """
    logger.info("Skill Worker started.")
    while True:
        try:
            await process_queued_items()
            await process_task_queue()
        except Exception as e:
            logger.error(f"Worker Loop Error: {e}", exc_info=True)
        
        await asyncio.sleep(2)

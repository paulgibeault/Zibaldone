import asyncio
import logging
import json
import traceback
from datetime import datetime, timezone
from typing import Dict, Any, List
import uuid

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
from app.config import settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Skills
skill_registry.load_skills()

# Processing Control
_is_paused = False
_resume_event = asyncio.Event() # Event to signal resumption
_running_tasks: Dict[str, asyncio.Task] = {}

def pause_processing():
    global _is_paused
    _is_paused = True
    _resume_event.clear()
    logger.info("Task processing PAUSED")

def resume_processing():
    global _is_paused
    _is_paused = False
    _resume_event.set()
    logger.info("Task processing RESUMED")

def get_processing_status():
    return "paused" if _is_paused else "running"

def cancel_running_task(task_id: str) -> bool:
    """
    Cancels a running asyncio task if found in the registry.
    Returns True if task was found and cancellation was triggered.
    """
    task = _running_tasks.get(str(task_id))
    if task:
        logger.info(f"Cancelling asyncio task: {task_id}")
        task.cancel()
        return True
    logger.warning(f"Task cancellation requested but not found in registry: {task_id}")
    return False

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
        if len(item_ids) > 0:
            logger.info(f"Worker polling: Found {len(item_ids)} queued items.")
    
    # Process outside the polling session
    for item_id in item_ids:
        # Check pause status between items
        if _is_paused:
            logger.info("Worker paused, stopping queue processing.")
            break

        # Yield control to event loop to prevent blocking API
        await asyncio.sleep(0.01)

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
                # Detect File Type
                try:
                    from app.services.file_detection import file_detector
                    detection_result = file_detector.detect(item.storage_path, item.original_filename)
                    
                    # Update Metadata
                    current_meta = item.item_metadata or {}
                    current_meta.update(detection_result)
                    item.item_metadata = current_meta
                    item.content_type = detection_result.get("mime_type", item.content_type)
                    
                    logger.info(f"Detected type for {item.original_filename}: {detection_result}")
                    session.add(item)
                    session.commit()
                except Exception as e:
                    logger.error(f"File detection failed for {item.id}: {e}")

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
    # Yield immediately to allow other requests (like polls) to process before we start blocking sync db work
    await asyncio.sleep(0.01)
    
    global _running_tasks
    """
    Executes a single task by ID using TaskContext.
    """
    if isinstance(task_id, str):
        task_uuid = uuid.UUID(task_id)
    else:
        task_uuid = task_id
        task_id = str(task_id)

    # Check pause status before execution
    if _is_paused:
        logger.info(f"System is paused. Skipping execution of task {task_id}")
        return

    # Register task for cancellation
    current_async_task = asyncio.current_task()
    if current_async_task:
        _running_tasks[task_id] = current_async_task

    try:
        from app.services.task_runner import TaskContext
        
        # We pass a session factory to TaskContext so it can manage its own session lifecycle
        # independent of the calling scope (though here we are top level task).
        session_factory = lambda: Session(engine)

        async with TaskContext(session_factory, task_uuid) as (session, task, ctx):
            # Task is already in RUNNING state here
            
            # Determine timeout
            skill_config = skill_registry.get_skill(task.name)
            timeout = skill_config.timeout if skill_config and skill_config.timeout else settings.DEFAULT_TASK_TIMEOUT

            # Execute Skill
            result = await asyncio.wait_for(skill_registry.execute_skill(task.name, ctx), timeout=timeout)
            
            # Post-execution logic (Metadata, Tags, etc.)
            item = task.item
            if not item: # Should be loaded by TaskContext/SQLModel relationship
                # Force reload if missing? TaskContext probably loaded task with default relationship loading
                # If lazy loading is on, accessing task.item works if session is open (it is).
                pass

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
                            is_approved=True
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
                prov['last_task'] = str(task.id)
                current['provenance'] = prov
                
                item.item_metadata = current
                session.add(item)

            # 2. Update Content (Versioning) - Placeholder
            if result.new_version_created and result.new_content:
                logger.info("New version creation requested - Not yet implemented fully")
                # TODO: Implement full versioning logic

            # 3. Finalize Task (Result JSON)
            
            # Use model_dump_json for Pydantic v2
            if hasattr(result, 'model_dump_json'):
                task.result_json = result.model_dump_json()
            else:
                task.result_json = result.json()

            # Check for logical failure in result
            is_failure = False
            if hasattr(result, 'status') and result.status == 'failure':
                is_failure = True
                task.status = TaskStatus.FAILED
                task.message = getattr(result, 'message', 'Task failed (logical)')
                logger.warning(f"Task {task.id} failed logically: {task.message}")
            
            # Note: TaskContext __aexit__ will see the status change (if any) or existing RUNNING status 
            # and update to COMPLETED if it's still RUNNING and no exception occurred.
            
            session.add(task)
            session.add(item)
            session.commit()
            
            # 4. Emit Events (AFTER commit to ensure data is visible)
            for evt in result.events_to_emit:
                await handle_event(session, evt, item.id)

    except Exception as e:
         # TaskContext already handles logging and status updates for exceptions INSIDE the block.
         # This catch block is for anything OUTSIDE the context (like session creation failure)
         # or if TaskContext decided to re-raise (e.g. CancelledError).
         if isinstance(e, asyncio.CancelledError):
             # Expected
             pass
         else:
             logger.error(f"Execution wrapper caught exception for {task_id}: {e}")

    finally:
        # Deregister
        if task_id in _running_tasks:
            del _running_tasks[task_id]


async def process_task_queue():
    """
    Polls for PENDING tasks and runs them.
    """
    # Use a separate session for polling
    with Session(engine) as session:
        statement = select(ProcessingTask.id).where(ProcessingTask.status == TaskStatus.PENDING)
        task_ids = session.exec(statement).all()
        if len(task_ids) > 0:
            logger.debug(f"Worker polling: Found {len(task_ids)} pending tasks.")
        
    for task_id in task_ids:
        if _is_paused:
            logger.info("Worker paused, stopping task processing.")
            break
            
        # Yield control to event loop to prevent blocking API
        await asyncio.sleep(0.01)

        # Check concurrency limit
        if len(_running_tasks) >= settings.MAX_CONCURRENT_TASKS:
            logger.debug(f"Max concurrent tasks reached ({len(_running_tasks)}/{settings.MAX_CONCURRENT_TASKS}). Waiting for tasks to finish.")
            break

        # Fire and forget (it registers itself in _running_tasks)
        # We use create_task to allow parallel execution up to the limit
        asyncio.create_task(execute_task(task_id))


async def process_unprocessed_items():
    """
    Main worker entry point.
    Renamed loops but keeping this function name for main.py compatibility.
    """
    logger.info("Skill Worker started.")
    while True:
        try:
            if _is_paused:
                # logger.info("Worker paused...") # Optional: reduce log spam
                pass 
            else:
                await process_queued_items()
                await process_task_queue()
        except asyncio.CancelledError:
             logger.info("Worker loop cancelled.")
             break
        except Exception as e:
            logger.error(f"Worker Loop Error: {e}", exc_info=True)
        
        # Wait for 2 seconds OR untill resumed if paused
        if _is_paused:
             await _resume_event.wait()
        else:
             await asyncio.sleep(2)

async def cleanup_stuck_tasks():
    """
    Called on startup to find tasks that were RUNNING when the server stopped.
    Marks them as FAILED.
    """
    logger.info("Cleaning up stuck tasks...")
    with Session(engine) as session:
        statement = select(ProcessingTask).where(ProcessingTask.status == TaskStatus.RUNNING)
        tasks = session.exec(statement).all()
        
        count = 0
        for task in tasks:
            logger.warning(f"Found stuck task {task.id} (Item: {task.item_id}, Name: {task.name})")
            task.status = TaskStatus.FAILED
            task.message = "Task interrupted by system restart"
            task.end_time = datetime.now(timezone.utc)
            session.add(task)
            count += 1
            
        session.commit()
        if count > 0:
            logger.info(f"Cleaned up {count} stuck tasks.")
        else:
            logger.info("No stuck tasks found.")

import asyncio
from sqlmodel import Session, select
from app.models import engine, ContentItem, ContentStatus, ProcessingTask, TaskStatus
import json
from datetime import datetime, timezone
from litellm import completion
from app import crud

from app.services.llm import LLMService
from app.services.storage import get_storage
from app.services.task_runner import TaskContext
from app.services.event_broadcaster import broadcaster
import os

storage = get_storage()

# Initialize LLM Service
# User can configure model via env var, e.g. "ollama/llama2"
llm_model = os.getenv("LLM_MODEL", "gpt-3.5-turbo") 
llm_service = LLMService(model=llm_model)

# Simple worker loop
# Simple worker loop

import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def process_item(item: ContentItem, session: Session, llm_service: LLMService):
    """
    Process a single item: extract content, generate metadata via LLM, 
    merge with existing metadata, and update status.
    """
    logger.info(f"Processing item: {item.original_filename}")
    
    # Update item status to PROCESSING
    item.status = ContentStatus.PROCESSING
    session.add(item)
    session.commit()
    
    # Broadcast event
    from app.services.event_broadcaster import broadcaster
    await broadcaster.broadcast(json.dumps({"type": "update", "item_id": str(item.id)}))

    # Create a processing task record
    # Create a processing task record
    # Note: We replaced the manual assignment with TaskContext below
    
    # Read content (assuming text for now, or just tagging filename)
    try:
        async with TaskContext(session, item.id, "Metadata Extraction") as task:
            # Load existing metadata
            existing_metadata = {}
            if item.metadata_json:
                try:
                    existing_metadata = json.loads(item.metadata_json)
                except json.JSONDecodeError:
                    logger.warning(f"Warning: Could not parse existing metadata for item {item.id}")
                    pass

            # Generate new metadata from LLM
            logger.info(f"Extracting metadata for {item.original_filename} using {llm_service.model}")
            
            # Fetch content for LLM processing
            try:
                content_bytes = await storage.get_content(item.storage_path)
                content_text = content_bytes.decode('utf-8', errors='ignore')
            except Exception as e:
                logger.error(f"Error fetching content for {item.original_filename}: {e}")
                content_bytes = None
                content_text = None

            llm_metadata = await llm_service.generate_metadata(
                item.storage_path, 
                content_text=content_text,
                content_bytes=content_bytes
            )
            logger.info(f"LLM metadata extracted for {item.original_filename}")
            
            merged_metadata = existing_metadata.copy()
            merged_metadata.update(llm_metadata)
            
            item.metadata_json = json.dumps(merged_metadata)

            # Save result to task
            task.result_json = json.dumps(llm_metadata, indent=2)
            session.add(task)
            
            # Process tags from LLM metadata
            # Expecting tags in llm_metadata['tags'] as a list of strings
            llm_tags = llm_metadata.get('tags', [])
        
        # --- Tag Alignment Step ---
        if isinstance(llm_tags, list) and len(llm_tags) > 0:
            # Create a specific task for Tag Alignment
            async with TaskContext(session, item.id, "Tag Alignment") as alignment_task:
                # Fetch all existing tags names for alignment
                all_tags = crud.get_tags(session, approved_only=True)
                existing_tag_names = [t.name for t in all_tags]
                
                logger.info(f"Aligning {len(llm_tags)} tags against {len(existing_tag_names)} existing tags...")
                aligned_tags = await llm_service.align_tags(llm_tags, existing_tag_names)
                
                logger.info(f"Tags aligned. Original: {llm_tags} -> Aligned: {aligned_tags}")
                
                # Use the aligned tags
                final_tags = aligned_tags
                
                # Update metadata with aligned tags if they changed
                if final_tags != llm_tags:
                    merged_metadata['tags'] = final_tags
                    item.metadata_json = json.dumps(merged_metadata)
                
                # Record result
                alignment_task.result_json = json.dumps({
                    "original_tags": llm_tags,
                    "existing_tags_count": len(existing_tag_names),
                    "aligned_tags": final_tags,
                    "changes": [t for t in final_tags if t not in llm_tags]
                }, indent=2)
                session.add(alignment_task)
                
                # Use final_tags for linking
                llm_tags = final_tags
                
        # --------------------------

        if isinstance(llm_tags, list):
            for tag_name in llm_tags:
                if not tag_name:
                    continue
                
                # Check if tag already exists
                tag = crud.get_tag_by_name(session, tag_name)
                if not tag:
                    # Create as unapproved autocreated tag
                    tag = crud.create_tag(
                        session, 
                        name=tag_name, 
                        color="#888888", 
                        is_autocreated=True, 
                        is_approved=False
                    )
                
                # Link tag to item if not already linked
                if tag not in item.tags:
                    item.tags.append(tag)

        item.status = ContentStatus.TAGGED
        session.add(item)
        
        session.commit()
        logger.info(f"Successfully processed and tagged {item.original_filename} (ID: {item.id})")
        
        # Broadcast event
        from app.services.event_broadcaster import broadcaster
        await broadcaster.broadcast(json.dumps({"type": "update", "item_id": str(item.id)}))

    except Exception as e:
        logger.error(f"Error processing item {item.id}: {e}", exc_info=True)
        
        # Update item status to FAILED
        item.status = ContentStatus.FAILED
        session.add(item)
        
        # Note: Individual tasks are handled by TaskContext so we don't need to fails them manually here
        # unless the error happened outside a TaskContext, in which case we might lose tracking.
        # But generally, TaskContext handles its own failure.
        
        session.commit()
        
        # Broadcast event
        from app.services.event_broadcaster import broadcaster
        await broadcaster.broadcast(json.dumps({"type": "update", "item_id": str(item.id)}))


async def process_unprocessed_items():
    while True:
        try:
            with Session(engine) as session:
                statement = select(ContentItem).where(ContentItem.status == ContentStatus.UNPROCESSED)
                results = session.exec(statement)
                items = results.all()
                
                for item in items:
                    print(f"Worker: Processing {item.original_filename}", flush=True)
                    await process_item(item, session, llm_service)
        except Exception as e:
            logger.error(f"Worker: Error in loop: {e}", exc_info=True)
                
        await asyncio.sleep(5) # Poll every 5 seconds

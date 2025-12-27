import asyncio
from sqlmodel import Session, select
from app.models import engine, ContentItem, ContentStatus
import json
from litellm import completion

from app.services.llm import LLMService
import os

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
    
    # Read content (assuming text for now, or just tagging filename)
    try:
        # Load existing metadata
        existing_metadata = {}
        if item.metadata_json:
            try:
                existing_metadata = json.loads(item.metadata_json)
            except json.JSONDecodeError:
                logger.warning(f"Warning: Could not parse existing metadata for item {item.id}")
                pass

        # Generate new metadata from LLM
        llm_metadata = await llm_service.generate_metadata(item.storage_path)
        
        # Merge: existing metadata takes precedence? 
        # Requirement: "not overwritten by the LLM, unless there is metadata key collisions, which LLM can overwrite"
        # So: start with existing, update with LLM (LLM overwrites collisions).
        # "Ensure the drop-time metadata is being sent with the file submission, and not overwritten by the LLM, 
        # unless there is metadata key collisions, which LLM can overwrite"
        # This means: merged = existing.copy(); merged.update(llm)
        
        merged_metadata = existing_metadata.copy()
        merged_metadata.update(llm_metadata)
        
        item.metadata_json = json.dumps(merged_metadata)
        item.status = ContentStatus.TAGGED
        session.add(item)
        session.commit()
        logger.info(f"Item {item.id} tagged. Metadata: {merged_metadata}")
        
        # Broadcast event
        from app.services.event_broadcaster import broadcaster
        await broadcaster.broadcast(json.dumps({"type": "update", "item_id": str(item.id)}))

    except Exception as e:
        logger.error(f"Error processing item {item.id}: {e}", exc_info=True)


async def process_unprocessed_items():
    while True:
        with Session(engine) as session:
            statement = select(ContentItem).where(ContentItem.status == ContentStatus.UNPROCESSED)
            results = session.exec(statement)
            items = results.all()
            
            for item in items:
                await process_item(item, session, llm_service)
                
        await asyncio.sleep(5) # Poll every 5 seconds

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
async def process_unprocessed_items():
    while True:
        with Session(engine) as session:
            statement = select(ContentItem).where(ContentItem.status == ContentStatus.UNPROCESSED)
            results = session.exec(statement)
            items = results.all()
            
            for item in items:
                print(f"Processing item: {item.original_filename}")
                
                # Read content (assuming text for now, or just tagging filename)
                # In real app, we'd extract text from files
                try:
                    # For MVP, if it's a text file, read it. Else just use filename.
                    content_text = f"Filename: {item.original_filename}"
                    if item.storage_path.endswith(".txt") or item.storage_path.endswith(".md"):
                        try:
                            with open(item.storage_path, "r") as f:
                                content_text += "\nContent:\n" + f.read()
                        except:
                            pass
                    
                    metadata = await llm_service.generate_metadata(content_text)
                    
                    item.metadata_json = json.dumps(metadata)
                    item.status = ContentStatus.TAGGED
                    session.add(item)
                    session.commit()
                    print(f"Item {item.id} tagged. Metadata: {metadata}")
                except Exception as e:
                    print(f"Error processing item {item.id}: {e}")
                
        await asyncio.sleep(5) # Poll every 5 seconds

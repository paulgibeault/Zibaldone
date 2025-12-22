import asyncio
import json
import sys
import os
from unittest.mock import MagicMock, AsyncMock

# Add backend directory to sys.path so we can import app modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.models import ContentItem, ContentStatus
from app.workers import process_item

async def test_metadata_merge():
    print("Starting metadata merge test...")
    
    # 1. Setup Mock objects
    mock_session = MagicMock()
    mock_llm_service = MagicMock()
    
    # Mock the generate_metadata to return some LLM data
    mock_llm_service.generate_metadata = AsyncMock(return_value={"llm_tag": "generated_by_llm", "description": "LLM description"})
    
    # 2. Create a ContentItem with existing metadata content
    existing_metadata = {
        "frontend_size": 12345, 
        "frontend_type": "image/png",
        "description": "Original description" # Collision to test overwrite behavior (LLM should overwrite)
    }
    
    item = ContentItem(
        original_filename="test_image.png",
        storage_path="/tmp/test_image.png",
        status=ContentStatus.UNPROCESSED,
        metadata_json=json.dumps(existing_metadata)
    )
    
    print(f"Initial metadata: {item.metadata_json}")
    
    # 3. Run the process_item function
    await process_item(item, mock_session, mock_llm_service)
    
    # 4. Verify results
    print(f"Final metadata: {item.metadata_json}")
    
    final_metadata = json.loads(item.metadata_json)
    
    # Check preserved keys
    if final_metadata.get("frontend_size") == 12345:
        print("PASS: frontend_size preserved")
    else:
        print("FAIL: frontend_size lost or changed")
        
    if final_metadata.get("frontend_type") == "image/png":
        print("PASS: frontend_type preserved")
    else:
        print("FAIL: frontend_type lost or changed")
        
    # Check LLM added keys
    if final_metadata.get("llm_tag") == "generated_by_llm":
        print("PASS: llm_tag added")
    else:
        print("FAIL: llm_tag missing")

    # Check collision (LLM overwrites existing)
    if final_metadata.get("description") == "LLM description":
        print("PASS: description overwritten by LLM (correct behavior per requirement)")
    else:
        print(f"FAIL: description failed to overwrite. Value: {final_metadata.get('description')}")

    # Check status update
    if item.status == ContentStatus.TAGGED:
        print("PASS: status updated to TAGGED")
    else:
        print(f"FAIL: status is {item.status}")
        
    # Check session commit
    mock_session.add.assert_called_with(item)
    mock_session.commit.assert_called_once()
    print("PASS: Session add/commit called")

if __name__ == "__main__":
    asyncio.run(test_metadata_merge())

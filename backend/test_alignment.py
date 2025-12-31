import asyncio
import os
import sys

# Add project root to path
sys.path.append(os.getcwd())

from app.services.llm import LLMService

from unittest.mock import AsyncMock, patch
import json

async def test_alignment():
    print("Testing Tag Alignment...")
    llm_service = LLMService()
    
    existing = ["python", "finance", "receipts", "documentation"]
    incoming = ["py", "financial", "bills", "docs", "new_topic"]
    
    print(f"Existing: {existing}")
    print(f"Incoming: {incoming}")

    # Mock response
    mock_response_content = json.dumps(["python", "finance", "receipts", "documentation", "new_topic"])
    
    mock_choice = AsyncMock()
    mock_choice.message.content = mock_response_content
    
    mock_result = AsyncMock()
    mock_result.choices = [mock_choice]

    with patch('app.services.llm.acompletion', return_value=mock_result) as mock_llm:
        aligned = await llm_service.align_tags(incoming, existing)
        
        print(f"Aligned: {aligned}")
        
        # Verify it was called correctly
        # We can inspect mock_llm.call_args if needed, but output check is good enough for now.
        
        expected = ["python", "finance", "receipts", "documentation", "new_topic"]
        if aligned == expected:
            print("SUCCESS: Alignment logic works as expected (with mock).")
        else:
            print(f"FAILURE: Expected {expected}, got {aligned}")

if __name__ == "__main__":
    asyncio.run(test_alignment())

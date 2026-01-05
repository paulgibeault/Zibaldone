
import asyncio
import os
import sys
from pathlib import Path
import json

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.services.llm import LLMService

async def verify_title_generation():
    print("Initializing LLM Service...")
    llm_service = LLMService()
    
    # Create a dummy text file
    test_file_path = "backend/test_title_gen.txt"
    with open(test_file_path, "w") as f:
        f.write("This is a test document about Space Exploration. It discusses the moon landing, Mars rovers, and future missions to the outer planets.")
        
    print(f"Created test file: {test_file_path}")
    
    try:
        print("Generating metadata...")
        # pass content_text explicitly as workers.py does
        with open(test_file_path, "r") as f:
            content_text = f.read()
            
        metadata = await llm_service.generate_metadata(
            test_file_path,
            content_text=content_text
        )
        
        print("\nGenerated Metadata:")
        print(json.dumps(metadata, indent=2))
        
        if "title" in metadata:
            print(f"\nSUCCESS: Title found: '{metadata['title']}'")
        else:
            print("\nFAILURE: 'title' field missing from metadata.")
            
    except Exception as e:
        print(f"\nError during metadata generation: {e}")
    finally:
        if os.path.exists(test_file_path):
            os.remove(test_file_path)
            print("Cleaned up test file.")

if __name__ == "__main__":
    asyncio.run(verify_title_generation())


import asyncio
import os
import json
import logging
import uuid
from pathlib import Path
from app.services.mcp_server import run_skill_in_sandbox
from app.config import settings

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("verify_metadata")

async def main():
    # Force filesystem storage for this test to avoid S3 connection issues
    settings.STORAGE_TYPE = "filesystem"
    # Ensure absolute path for storage
    repo_root = Path(__file__).resolve().parent.parent 
    settings.STORAGE_DIR = str(repo_root / "data" / "blob_storage")
    
    logger.info(f"Forced STORAGE_TYPE=filesystem, STORAGE_DIR={settings.STORAGE_DIR}")
    
    logger.info("Starting Metadata Extraction Verification")
    
    # 1. Create a dummy file to extract metadata from
    test_content = """
    The Apollo 11 mission was the spaceflight that first landed humans on the Moon. 
    Commander Neil Armstrong and lunar module pilot Buzz Aldrin formed the American crew that landed the Apollo Lunar Module Eagle on July 20, 1969, at 20:17 UTC. 
    Armstrong became the first person to step onto the lunar surface six hours and 39 minutes later on July 21 at 02:56 UTC; Aldrin joined him 19 minutes later. 
    They spent about two and a quarter hours together outside the spacecraft, and they collected 47.5 pounds (21.5 kg) of lunar material to bring back to Earth. 
    Command module pilot Michael Collins flew the Command and Service Module Columbia alone in lunar orbit while they were on the Moon's surface. 
    Armstrong and Aldrin spent 21 hours, 36 minutes on the lunar surface at a site they named Tranquility Base before lifting off to rejoin Columbia in lunar orbit.
    """
    
    # We need to simulate the file being available. 
    # In the real flow, 'storage_path' would be a path in the storage directory.
    # But run_skill_in_sandbox handles content injection via 'storage_path' by calling storage service.
    # To avoid depending on the storage service in this standalone test, we can trick `run_skill_in_sandbox` 
    # OR we can just pass the content directly if we modify the skill to accept direct input (which it does via stdin in some cases, but here via file).
    
    # Actually, let's look at `run_skill_in_sandbox`. It tries to read from storage if `storage_path` is present.
    # If we want to test the FULL flow including injection, we need a valid storage entry.
    # But for a quick verification, we can rely on the fact that `run_skill_in_sandbox` injects files_to_inject.
    
    # Alternative: The skill script reads from a file path provided as argv[1].
    # `run_skill_in_sandbox` constructs the command: `python /app/skill.py {container_content_path}`
    # It determines `container_content_path` by reading from storage.
    
    # Hack: We can manually call `run_skill_in_sandbox` but since it has internal dependency on `get_storage`, 
    # we might hit the "Failed to fetch content" error.
    # However, `mcp_server.py` catches that error and continues.
    # But then `container_content_path` will be empty string.
    # And `python /app/skill.py ` (empty arg) might fail or print usage.
    
    # Let's see `skill.py`:
    # if len(sys.argv) < 2: print("No input provided"); sys.exit(1)
    
    # So we MUST successfully inject a file.
    # The clean way is to ensure `app.services.storage` works.
    # It defaults to filesystem storage at `../data/blob_storage`.
    
    # Let's create a temporary file in the storage directory.
    storage_dir = Path(settings.STORAGE_DIR)
    if not storage_dir.is_absolute():
        # assume relative to backend/app/config.py -> backend/app -> ...
        # logic in config.py is `../data/blob_storage`
        # relative to where? usually CWD of process.
        # Let's try to resolve it relative to `verify_restart_fix.py` which is in root of repo? No, this script is in `backend/`.
        repo_root = Path.cwd()
        storage_dir = repo_root / "data" / "blob_storage"
    
    storage_dir.mkdir(parents=True, exist_ok=True)
    
    test_filename = f"apollo_test_{uuid.uuid4()}.txt"
    test_filepath = storage_dir / test_filename
    
    logger.info(f"Creating test file at {test_filepath}")
    with open(test_filepath, "w") as f:
        f.write(test_content)
        
    # Now trigger skill
    # storage_path is relative to storage dir usually? 
    # Storage service `FileSystemStorage` uses `safe_join(self.base_path, path)`.
    # So just the filename should work if it's in the root of storage dir.
    
    try:
        logger.info(f"Triggering skill 'metadata_extraction' for {test_filename}...")
        
        logs = await run_skill_in_sandbox(
            "metadata_extraction", 
            {
                "storage_path": test_filename,
                "original_filename": "apollo11.txt"
            }
        )
        
        logger.info("Skill execution completed. Analyzing output...")
        logger.info(f"Logs:\n{logs}")
        
        # Parse last line
        lines = logs.strip().split('\n')
        last_line = lines[-1]
        
        try:
            result = json.loads(last_line)
            logger.info(f"Parsed Result: {json.dumps(result, indent=2)}")
            
            if result.get("status") == "success":
                metadata = result.get("metadata_patch", {})
                summary = metadata.get("summary", "")
                keywords = metadata.get("keywords", [])
                
                logger.info(f"Summary: {summary}")
                logger.info(f"Keywords: {keywords}")
                
                if "Apollo 11" in summary or "Armstrong" in summary:
                    logger.info("✅ SUCCESS: Summary contains expected content from LLM!")
                elif "LLM Failed" in summary:
                    logger.error("❌ FAILURE: Skill fell back to heuristic/error mode.")
                elif "processed summary of the file" in summary:
                    logger.error("❌ FAILURE: Skill returned mock data! Old version running?")
                else:
                    logger.warning(f"⚠️ UNCERTAIN: Summary '{summary}' might be from LLM but looks generic.")
            else:
                logger.error(f"❌ FAILURE: Skill returned status {result.get('status')}")
                
        except json.JSONDecodeError:
            logger.error("❌ FAILURE: Could not parse JSON from last line of logs.")

    except Exception as e:
        logger.error(f"Execution failed: {e}", exc_info=True)
        
    finally:
        # cleanup
        if test_filepath.exists():
            os.remove(test_filepath)

if __name__ == "__main__":
    asyncio.run(main())

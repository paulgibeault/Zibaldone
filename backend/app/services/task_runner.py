
import asyncio
import json
import logging
import uuid
import traceback
import os
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Session, select

from app.models import ProcessingTask, TaskStatus, Tag, ContentItem
from app import crud
from app.services.event_broadcaster import broadcaster
from app.services.sandbox import MacDockerSandbox
from app.services.skill_sdk import SkillContext, SkillResult

logger = logging.getLogger(__name__)

# Config - where are the skills located in the container?
# OR we map them from host.
SKILLS_HOST_PATH = os.path.join(os.getcwd(), "backend/skills") 
if not os.path.exists(SKILLS_HOST_PATH):
    # Try relative to current wd
    SKILLS_HOST_PATH = os.path.join(os.getcwd(), "skills")

# We map this to /app/skills in the container
SKILLS_CONTAINER_PATH = "/app/skills"

class TaskContext:
    """
    Async Context Manager for encapsulating processing tasks.
    """
    def __init__(self, session_factory, task_id: uuid.UUID):
        self.session_factory = session_factory
        self.task_id = task_id
        self.session: Optional[Session] = None
        self.task: Optional[ProcessingTask] = None
        self.item_id: Optional[uuid.UUID] = None
        self.sandbox = MacDockerSandbox()

    async def __aenter__(self):
        self.session = self.session_factory()
        
        try:
            self.task = self.session.get(ProcessingTask, self.task_id)
            if not self.task:
                raise ValueError(f"Task {self.task_id} not found")
            
            if self.task.status in [TaskStatus.COMPLETED, TaskStatus.FAILED]:
                 raise ValueError(f"Task {self.task_id} is already in terminal state {self.task.status}")

            self.item_id = self.task.item_id
            
            # Mark RUNNING
            self.task.status = TaskStatus.RUNNING
            self.task.start_time = datetime.now(timezone.utc)
            self.session.add(self.task)
            self.session.commit()
            self.session.refresh(self.task)
            
            await broadcaster.broadcast(json.dumps({
                "type": "update", 
                "item_id": str(self.item_id)
            }))
            
            logger.info(f"Task Started: {self.task.name} for item {self.item_id}")
            
            # Prepare SkillContext
            item = self.task.item
            # Ensure item is loaded
            if not item:
                # Should be loaded implies lazy loading or we need to refresh with relation?
                # accessing it should trigger load if session is active
                pass

            existing_tags_objs = crud.get_tags(self.session, owner_id=item.owner_id, approved_only=False)
            existing_tags = [t.name for t in existing_tags_objs]
            
            ctx = SkillContext(
                item_id=str(item.id),
                original_filename=item.original_filename,
                storage_path=item.storage_path,
                metadata=item.item_metadata or {},
                params=self.task.parameters or {},
                existing_tags=existing_tags
            )
            
            return self.session, self.task, ctx
            
        except Exception:
            if self.session:
                self.session.close()
            raise

    async def run_skill(self, skill_name: str) -> bool:
        """
        Executes the skill logic via Sandbox.
        """
        try:
            # 1. Prepare Context Data (Pre-fetch)
            item = self.task.item
            if not item:
                raise ValueError("Task has no associated item")
                
            # Fetch existing tags for tag_alignment
            existing_tags_objs = crud.get_tags(self.session, owner_id=item.owner_id, approved_only=False)
            existing_tags = [t.name for t in existing_tags_objs]
            
            # Prepare inputs
            # For simplicity, we pass inputs as JSON file or stdin.
            # We'll use a temp file for input json.
            
            input_data = {
                "item_id": str(item.id),
                "original_filename": item.original_filename,
                "storage_path": item.storage_path, # Path in S3/Local
                "metadata": item.item_metadata or {},
                "params": self.task.parameters or {},
                "existing_tags": existing_tags,
                # For tag_alignment which expects 'tags' in root of input sometimes
                "tags": (item.item_metadata or {}).get("tags", [])
            }
            
            # Determine script path
            # skill_name e.g. "file_interrogation" -> backend/skills/file_interrogation/skill.py
            skill_script_rel = f"{skill_name}/skill.py"
            
            # 2. Run in Sandbox
            # We need to map the skill script and the content file.
            # The 'MacDockerSandbox' is generic.
            
            # For this iteration, we assume the container has python installed.
            # We'll use a basic python image.
            
            # Helper to write input.json
            import tempfile
            with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
                json.dump(input_data, f)
                input_json_path = f.name
            
            try:
                # Volume Mapping
                # 1. Skills directory (Read Only) -> /skills
                # 2. Inject Input JSON & Content File via 'files' argument
                
                from app.services.storage import get_storage
                storage = get_storage()
                
                # Get Content (Bytes)
                content_bytes = await storage.get_content(item.storage_path)
                
                # Prepare Injection Map
                input_json_str = json.dumps(input_data)
                
                # Determine container path for content
                content_filename = os.path.basename(item.original_filename)
                # sanitize filename?
                container_content_path = f"/data/{content_filename}"
                
                files_to_inject = {
                    "/input.json": input_json_str,
                    container_content_path: content_bytes
                }

                volumes = {
                    SKILLS_HOST_PATH: {'bind': '/skills', 'mode': 'ro'},
                }
                
                cmd = f"python /skills/{skill_script_rel} {container_content_path}"
                
                # If the skill takes JSON via stdin, we might do: `cat /input.json | python ...`
                # Let's support both. We pass mapped_file_path as arg1.
                # And we can pipe input.json? 
                # Docker cmd: `sh -c 'cat /input.json | python ...'`
                
                full_cmd = f"sh -c 'cat /input.json | python /skills/{skill_script_rel} {container_content_path}'"

                logs = await self.sandbox.run_container(
                    image="python:3.11-slim",
                    command=full_cmd,
                    volumes=volumes,
                    files=files_to_inject,
                    working_dir="/skills"
                )
                
                # Parse Output (Last line should be JSON)
                lines = logs.strip().split('\n')
                last_line = lines[-1] if lines else "{}"
                
                try:
                    result_data = json.loads(last_line)
                    result = SkillResult(**result_data)
                except json.JSONDecodeError:
                    raise Exception(f"Skill did not return valid JSON. Logs:\n{logs}")
                    
                # 3. Apply Side Effects
                
                # Update Metadata
                if result.metadata_patch:
                    current_meta = dict(item.item_metadata or {})
                    current_meta.update(result.metadata_patch)
                    item.item_metadata = current_meta
                    item.last_processed = datetime.now(timezone.utc)
                    
                # Add Tags
                if result.tags_to_add:
                    for tag_name in result.tags_to_add:
                        # Idempotent add/create
                        tag = crud.get_tag_by_name(self.session, tag_name, owner_id=item.owner_id)
                        if not tag:
                            tag = crud.create_tag(self.session, tag_name, item.owner_id, is_autocreated=True)
                        elif not tag.is_approved:
                             # Auto-verify if skill implies trust? Or wait for user?
                             # Original logic: align_tags approved existing ones.
                             pass
                        
                        if tag not in item.tags:
                            item.tags.append(tag)
                            
                self.session.add(item)
                self.session.commit()
                
                return True
                
            finally:
                if os.path.exists(input_json_path):
                    os.unlink(input_json_path)

        except Exception as e:
            logger.error(f"Run Skill Failed: {e}")
            raise

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if not self.session or not self.task:
             if self.session: self.session.close()
             return

        end_time = datetime.now(timezone.utc)
        
        try:
            if exc_type:
                logger.error(f"Task Failed: {exc_val}")
                self.update_task_status(TaskStatus.FAILED, str(exc_val), end_time)
            else:
                self.update_task_status(TaskStatus.COMPLETED, "Success", end_time)
            
            if self.item_id:
                await broadcaster.broadcast(json.dumps({
                    "type": "update", 
                    "item_id": str(self.item_id)
                }))

        finally:
            self.session.close()
        
        if exc_type is asyncio.CancelledError:
             return False
        return True

    def update_task_status(self, status, message, end_time):
        try:
            crud.update_task(self.session, self.task.id, status=status, message=message, end_time=end_time)
        except Exception as e:
            logger.error(f"Db update failed: {e}")


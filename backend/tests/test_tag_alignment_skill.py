import pytest
from unittest.mock import AsyncMock, patch
from sqlmodel import Session
from app.models import User, ContentItem, Tag, ProcessingTask
from app.services.skill_sdk import SkillContext
from backend.skills.tag_alignment.skill import run as run_skill # Adjust import if needed
import uuid

# We need to import the run function. Since it is in backend/skills/tag_alignment/skill.py
# and we are running from root, we might need to adjust python path or use relative import if possible.
# However, the file structure suggests `backend/skills` might not be a package.
# Let's try importing assuming standard python path or dynamic import if needed.
# But for now, let's assume `app` is in path, but `backend.skills` is not standard.
# Actually, the file is `backend/skills/tag_alignment/skill.py`.
# If we run pytest from `backend/`, we can import `skills.tag_alignment.skill`.

try:
    from skills.tag_alignment import skill
except ImportError:
    # If running from backend root, skills might be reachable
    import sys
    import os
    sys.path.append(os.path.join(os.getcwd(), 'skills'))
    from skills.tag_alignment import skill

@pytest.mark.asyncio
async def test_tag_alignment_logic(session: Session):
    # 1. Setup Data
    user = User(display_name="Test User", is_admin=False)
    session.add(user)
    session.commit()
    
    # Create Item
    item = ContentItem(
        original_filename="test_doc.txt",
        storage_path="test/path",
        owner_id=user.id,
        item_metadata={"tags": ["receipt", "coding", "new_thing"]} # Input tags
    )
    session.add(item)
    session.commit()
    
    # Create Existing Tags
    # Tag 1: Verified (Approved)
    t1 = Tag(name="receipts", owner_id=user.id, is_approved=True)
    session.add(t1)
    
    # Tag 2: Unverified (Unapproved)
    t2 = Tag(name="development", owner_id=user.id, is_approved=False)
    session.add(t2)
    
    session.commit()
    session.refresh(t1)
    session.refresh(t2)
    
    # 2. Mock Context & LLM
    # Create a dummy task for context
    dummy_task = ProcessingTask(
        item_id=item.id,
        name="Tag Alignment",
        owner_id=user.id
    )
    session.add(dummy_task)
    session.commit()
    
    ctx = SkillContext(session=session, task=dummy_task, item=item)
    
    # Mock LLM align_tags return
    # Input: ["receipt", "coding", "new_thing"]
    # Mapping we want to test:
    # "receipt" -> "receipts" (Verified)
    # "coding" -> "development" (Unverified -> Should become Verified)
    # "new_thing" -> "new_thing" (New -> should be Created as Unverified)
    
    aligned_tags_output = ["receipts", "development", "new_thing"]
    
    with patch("app.services.llm.LLMService.align_tags", new_callable=AsyncMock) as mock_align:
        mock_align.return_value = aligned_tags_output
        
        # 3. Run Skill
        result = await skill.run(ctx)
        
        # 4. Verify Results
        
        # Check LLM call arguments to ensure it received ALL tags (including unverified 'development')
        # align_tags(new_tags, existing_tags)
        call_args = mock_align.call_args
        assert call_args is not None
        _, existing_passed = call_args[0]
        assert "receipts" in existing_passed
        assert "development" in existing_passed # Crucial check: unverified tag was passed to LLM
        
        # Check Item Tags
        session.refresh(item)
        item_tag_names = [t.name for t in item.tags]
        assert "receipts" in item_tag_names
        assert "development" in item_tag_names
        assert "new_thing" in item_tag_names
        
        # Check Tag Status
        
        # "receipts" should remain verified
        tag_receipts = session.exec(select(Tag).where(Tag.name == "receipts")).first()
        assert tag_receipts.is_approved == True
        
        # "development" should NOW be verified (auto-verified)
        tag_dev = session.exec(select(Tag).where(Tag.name == "development")).first()
        assert tag_dev.is_approved == True 
        
        # "new_thing" should be unverified (newly created)
        tag_new = session.exec(select(Tag).where(Tag.name == "new_thing")).first()
        assert tag_new.is_approved == False

# Helper import for the test logic inside (avoiding top level import issues if possible)
from sqlmodel import select

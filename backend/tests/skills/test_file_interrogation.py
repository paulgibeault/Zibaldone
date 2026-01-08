
import pytest
import os
from unittest.mock import MagicMock, patch
from skills.file_interrogation import skill
from app.models import ContentItem, ProcessingTask
from app.services.skill_sdk import SkillContext

# Path to sample data
DATA_DIR = os.path.join(os.path.dirname(__file__), "../data/interrogation_samples")

@pytest.fixture
def mock_context():
    # Patch get_storage where SkillContext uses it
    with patch("app.services.skill_sdk.get_storage") as mock_get_storage:
        mock_get_storage.return_value = MagicMock()
        
        # Create mock session
        session = MagicMock()
        
        # Create mock item
        item = ContentItem(
            original_filename="test.txt",
            storage_path="test/path",
            id="12345678-1234-5678-1234-567812345678"
        )
        
        # Create mock task
        task = ProcessingTask(
            id="87654321-4321-8765-4321-876543210987",
            item_id=item.id,
            name="File Interrogation"
        )
        
        # Create context
        ctx = SkillContext(session, task, item)
        
        # Mock read_file_content to be an async method
        # We replace the method on the instance, so we don't need to patch the class
        ctx.read_file_content = AsyncMock(return_value=b"") 
        return ctx

from unittest.mock import AsyncMock

@pytest.mark.asyncio
async def test_markdown_with_extension(mock_context):
    # Setup
    filename = "sample.md"
    mock_context.item.original_filename = filename
    
    # Read real sample file
    with open(os.path.join(DATA_DIR, filename), "rb") as f:
        content = f.read()
    mock_context.read_file_content.return_value = content
    
    # Run
    result = await skill.run(mock_context)
    
    # Verify
    assert result.status == "success"
    assert result.metadata_patch["mime_type"] == "text/markdown"
    assert "content_text_ready" in result.events_to_emit

@pytest.mark.asyncio
async def test_python_script(mock_context):
    # Setup
    filename = "script.py"
    mock_context.item.original_filename = filename
    
    with open(os.path.join(DATA_DIR, filename), "rb") as f:
        content = f.read()
    mock_context.read_file_content.return_value = content
    
    # Run
    result = await skill.run(mock_context)
    
    # Verify
    assert result.status == "success"
    assert result.metadata_patch["mime_type"] in ["text/x-python", "text/plain"]
    assert "content_text_ready" in result.events_to_emit

@pytest.mark.asyncio
async def test_json_file(mock_context):
    # Setup
    filename = "data.json"
    mock_context.item.original_filename = filename
    
    with open(os.path.join(DATA_DIR, filename), "rb") as f:
        content = f.read()
    mock_context.read_file_content.return_value = content
    
    # Run
    result = await skill.run(mock_context)
    
    # Verify
    assert result.status == "success"
    assert result.metadata_patch["mime_type"] == "application/json"
    assert "content_text_ready" in result.events_to_emit

@pytest.mark.asyncio
async def test_binary_file(mock_context):
    # Setup
    filename = "binary.dat"
    mock_context.item.original_filename = filename
    
    with open(os.path.join(DATA_DIR, filename), "rb") as f:
        content = f.read()
    mock_context.read_file_content.return_value = content
    
    # Run
    result = await skill.run(mock_context)
    
    # Verify
    assert result.status == "success"
    assert result.metadata_patch["mime_type"] == "application/octet-stream"
    assert "content_text_ready" not in result.events_to_emit

@pytest.mark.asyncio
async def test_markdown_no_extension(mock_context):
    # Setup
    filename = "sample_no_ext"
    mock_context.item.original_filename = filename
    
    with open(os.path.join(DATA_DIR, filename), "rb") as f:
        content = f.read()
    mock_context.read_file_content.return_value = content
    
    # Run
    result = await skill.run(mock_context)
    
    # Verify
    assert result.status == "success"
    assert result.metadata_patch["mime_type"] == "text/plain" 
    assert "content_text_ready" in result.events_to_emit

@pytest.mark.asyncio
async def test_missing_filename(mock_context):
    # Setup
    filename = "sample_no_ext"
    mock_context.item.original_filename = None
    
    with open(os.path.join(DATA_DIR, filename), "rb") as f:
        content = f.read()
    mock_context.read_file_content.return_value = content
    
    # Run
    result = await skill.run(mock_context)
    
    # Verify
    assert result.status == "success"
    assert result.metadata_patch["mime_type"] == "text/plain"
    assert "content_text_ready" in result.events_to_emit

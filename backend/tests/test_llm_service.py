import pytest
import os
from unittest.mock import AsyncMock, patch
from pathlib import Path
from app.services.llm import LLMService

@pytest.fixture
def llm_service():
    return LLMService(model="test-model")

@pytest.mark.asyncio
async def test_get_type_for_extension(llm_service):
    assert llm_service._get_type_for_extension(".txt") == "text"
    assert llm_service._get_type_for_extension(".jpg") == "image"
    assert llm_service._get_type_for_extension(".unknown") == "default"

@pytest.mark.asyncio
async def test_load_prompt_config(llm_service):
    prompt = llm_service._load_prompt_config("text")
    assert "Analyze the following file" in prompt
    assert "This is a text-based file" in prompt
    assert "common_schema.json" not in prompt # It should contain the CONTENT of the schema, not the filename
    assert '"summary":' in prompt

@patch("app.services.llm.acompletion")
@pytest.mark.asyncio
async def test_generate_metadata_text(mock_acompletion, llm_service, tmp_path):
    # Create a dummy text file
    txt_path = tmp_path / "test.txt"
    txt_path.write_text("Some content from file")

    # Mock response
    mock_response = AsyncMock()
    mock_response.choices = [
        AsyncMock(message=AsyncMock(content='{"summary": "test", "tags": ["a"], "sentiment": "neutral"}'))
    ]
    mock_acompletion.return_value = mock_response

    # Call with path only
    result = await llm_service.generate_metadata(str(txt_path))
    
    assert result["summary"] == "test"
    mock_acompletion.assert_called_once()
    args, kwargs = mock_acompletion.call_args
    assert "This is a text-based file" in kwargs["messages"][0]["content"]
    assert "Some content from file" in kwargs["messages"][0]["content"]

@patch("app.services.llm.acompletion")
@pytest.mark.asyncio
async def test_generate_metadata_image(mock_acompletion, llm_service, tmp_path):
    # Create a dummy image file
    img_path = tmp_path / "test.jpg"
    img_path.write_bytes(b"dummy image data")

    mock_response = AsyncMock()
    mock_response.choices = [
        AsyncMock(message=AsyncMock(content='{"summary": "image test", "tags": ["img"], "sentiment": "neutral", "color_palette": ["#000"]}'))
    ]
    mock_acompletion.return_value = mock_response

    result = await llm_service.generate_metadata(str(img_path))
    
    assert result["summary"] == "image test"
    assert result["color_palette"] == ["#000"]
    
    mock_acompletion.assert_called_once()
    args, kwargs = mock_acompletion.call_args
    content = kwargs["messages"][0]["content"]
    assert isinstance(content, list)
    assert content[1]["type"] == "image_url"

def test_truncate_content(llm_service):
    prompt = "Test prompt"
    # Create a very long content
    long_content = "Word " * 5000 
    
    with patch("app.services.llm.get_max_tokens", return_value=128): # Very small limit
        truncated = llm_service._truncate_content(prompt, long_content, "test-model")
        # Ensure it's shorter than original
        assert len(truncated) < len(long_content)
        # Should be roughly available_tokens * 3 
        # max 128 - 1500 reserve is negative, so it should hit the safety fallback
        assert len(truncated) == 1000

def test_truncate_content_large(llm_service):
    prompt = "Test prompt"
    long_content = "Word " * 2000
    
    with patch("app.services.llm.get_max_tokens", return_value=4096):
        # available_tokens = 4096 - 1500 = 2596
        # Threshold = 2596 * 4 = 10384 characters
        # long_content is "Word " * 2000 = 10000 characters
        # So it still won't trigger if we use "Word " * 2000.
        # Let's use more words.
        very_long_content = "Word " * 4000 # 20000 characters
        
        with patch("app.services.llm.token_counter", return_value=2000):
            # Should not truncate if it fits within token limit
            truncated = llm_service._truncate_content(prompt, very_long_content, "test-model")
            assert truncated == very_long_content

        with patch("app.services.llm.token_counter", return_value=5000):
            # Should truncate if it doesn't fit within token limit
            truncated = llm_service._truncate_content(prompt, very_long_content, "test-model")
            assert len(truncated) < len(very_long_content)

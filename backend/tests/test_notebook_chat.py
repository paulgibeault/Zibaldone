import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from sqlmodel import Session
from app.main import app
from app.models import Notebook, ContentItem, User, ContentItemNotebookLink
from app.api.endpoints.auth import get_current_user
import uuid

@pytest.fixture
def current_user(session):
    user = User(display_name="Test User", id=uuid.uuid4())
    session.add(user)
    session.commit()
    return user

@pytest.fixture
def client_with_auth(client, current_user):
    app.dependency_overrides[get_current_user] = lambda: current_user
    yield client
    if get_current_user in app.dependency_overrides:
        del app.dependency_overrides[get_current_user]

@patch("app.api.endpoints.notebooks.LLMService")
def test_notebook_chat(MockLLMService, client_with_auth, session: Session, current_user: User):
    # Setup Mock
    mock_llm_instance = MockLLMService.return_value
    mock_llm_instance.chat_with_context = AsyncMock(return_value={"content": "Hello from LLM", "debug_info": {}})
    
    # Create notebook
    notebook = Notebook(title="Chat NB", owner_id=current_user.id)
    session.add(notebook)
    session.commit()
    
    # Create item
    item = ContentItem(original_filename="test.txt", storage_path="test.txt", owner_id=current_user.id)
    session.add(item)
    session.commit()
    
    # Link item (optional but good for realism)
    link = ContentItemNotebookLink(notebook_id=notebook.id, item_id=item.id)
    session.add(link)
    session.commit()
    
    # Request
    response = client_with_auth.post(
        f"/api/notebooks/{notebook.id}/chat",
        json={
            "message": "Hello",
            "context_item_ids": [str(item.id)],
            "chat_history": []
        }
    )
    
    # Assert
    assert response.status_code == 200, response.text
    assert response.json()["response"] == "Hello from LLM"
    
    # Verify mocked call
    mock_llm_instance.chat_with_context.assert_called_once()
    call_args = mock_llm_instance.chat_with_context.call_args
    messages, context_items = call_args[0]
    
    assert messages[-1]["content"] == "Hello"
    assert len(context_items) == 1
    assert context_items[0]["original_filename"] == "test.txt"
    assert context_items[0]["storage_path"] == "test.txt"

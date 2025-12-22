from fastapi.testclient import TestClient
from sqlmodel import Session
from app.models import ContentItem, ContentStatus

def test_read_root(client: TestClient):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Welcome to Zibaldone"}

def test_create_item(client: TestClient, session: Session):
    # Depending on how the API is structured, we might need to mock file upload
    # But checking if we can query the empty DB is a good start.
    
    # Let's try to query items (assuming GET /api/items exists from previous context)
    # The user didn't show me api.py completely, but App.tsx uses getItems().
    # Let's assume GET /api/items is valid.
    
    response = client.get("/api/items")
    # It might be 404 if I didn't verify api.py path.
    # main.py includes router with prefix "/api".
    # api.py likely has metadata/items.
    
    # If the route exists, it should be 200 and empty list.
    assert response.status_code == 200
    assert response.json() == []

    # Test creating item manually in DB and reading it back via API
    item = ContentItem(original_filename="test.txt", storage_path="/tmp/test.txt")
    session.add(item)
    session.commit()
    
    response = client.get("/api/items")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["original_filename"] == "test.txt"

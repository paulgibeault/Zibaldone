import pytest
from sqlmodel import SQLModel, Session, create_engine
from fastapi.testclient import TestClient
from app.main import app
from app.models import get_session, ContentItem, Tag, ProcessingTask

from sqlalchemy.pool import StaticPool

# Use in-memory SQLite for tests
sqlite_url = "sqlite://"
engine = create_engine(
    sqlite_url, 
    connect_args={"check_same_thread": False}, 
    poolclass=StaticPool
)

@pytest.fixture(name="session")
def session_fixture():
    SQLModel.metadata.create_all(engine)
    print("Tables created:", list(SQLModel.metadata.tables.keys()))
    with Session(engine) as session:
        yield session
    SQLModel.metadata.drop_all(engine)

@pytest.fixture(name="client")
def client_fixture(session: Session):
    def get_session_override():
        return session

    app.dependency_overrides[get_session] = get_session_override
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()

@pytest.fixture
def mock_broadcaster(monkeypatch):
    from app.services.event_broadcaster import broadcaster
    
    async def mock_broadcast(*args, **kwargs):
        pass

    monkeypatch.setattr(broadcaster, "broadcast", mock_broadcast)
    return broadcaster

@pytest.fixture
def mock_storage(monkeypatch):
    class MockStorage:
        def get_download_url(self, path):
            return f"http://mock-storage/{path}"
        
        async def get_content(self, path):
            return b"mock content"

    storage = MockStorage()
    
    # Patch where it is used. Note: We might need to patch 'app.services.storage.get_storage' 
    # or the module level variable where it's imported.
    # For now, let's patch the get_storage function in storage.py if possible, 
    # or the imported instances in other files.
    
    # Since we can't easily patch the return value of get_storage() globally if it's already called at module level,
    # we'll look at how it's used.
    # workers.py: storage = get_storage() -> at module level.
    # item_service.py: storage = get_storage() -> at module level.
    
    # We need to patch the 'storage' variable in those modules.
    monkeypatch.setattr("app.services.item_service.storage", storage)
    monkeypatch.setattr("app.workers.storage", storage)
    
    return storage

@pytest.fixture
def mock_llm_service(monkeypatch):
    class MockLLMService:
        model = "mock-model"
        
        async def generate_metadata(self, *args, **kwargs):
            return {"title": "Mock Title", "tags": ["mock-tag"]}
            
        async def align_tags(self, tags, existing_tags):
            return tags

    llm_service = MockLLMService()
    monkeypatch.setattr("app.workers.llm_service", llm_service)
    return llm_service

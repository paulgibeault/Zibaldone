import sys
import os
import io

# Add backend directory to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app
from app.services.auth import create_user, create_session
from app.models import get_session, User, Session as UserSession
from sqlmodel import Session, select, create_engine

# Use an in-memory DB for testing to avoid messaging with real data
from app.models import SQLModel
from sqlmodel.pool import StaticPool
sqlite_url = "sqlite:///:memory:"
engine = create_engine(sqlite_url, connect_args={"check_same_thread": False}, poolclass=StaticPool)

def get_session_override():
    with Session(engine) as session:
        yield session

app.dependency_overrides[get_session] = get_session_override

# Create tables
SQLModel.metadata.create_all(engine)

client = TestClient(app)

def setup_auth():
    with Session(engine) as session:
        user = create_user(session, "Test User")
        device_session, token = create_session(session, user.id, "Test Device")
        return token

def test_upload_bug():
    print("\n--- Testing Upload WITH Bug (Manual Content-Type) ---")
    token = setup_auth()
    
    file_content = b"fake file content"
    files = {"file": ("test.txt", file_content, "text/plain")}
    headers = {
        "Authorization": f"Bearer {token}",
        # This is the BUG: Manual Content-Type without boundary
        "Content-Type": "multipart/form-data" 
    }
    
    try:
        response = client.post("/api/upload", files=files, headers=headers)
        print(f"Response Status: {response.status_code}")
        print(f"Response Body: {response.json()}")
        
        if response.status_code != 200:
            print("SUCCESS: Reproduced bug (upload failed as expected with bad header).")
        else:
            print("FAILURE: Upload succeeded despite bad header? That's unexpected.")
            
    except Exception as e:
        print(f"Exception during request: {e}")

def test_upload_fix():
    print("\n--- Testing Upload WITHOUT Bug (Correct Headers) ---")
    token = setup_auth()
    
    file_content = b"fake file content"
    files = {"file": ("test.txt", file_content, "text/plain")}
    headers = {
        "Authorization": f"Bearer {token}"
        # No manual Content-Type; requests/TestClient sets it correctly with boundary
    }
    
    response = client.post("/api/upload", files=files, headers=headers)
    print(f"Response Status: {response.status_code}")
    print(f"Response Body: {response.json()}")
    
    if response.status_code == 200:
        print("SUCCESS: Upload verified (succeeded with correct headers).")
    else:
        print("FAILURE: Upload failed even with correct headers.")

if __name__ == "__main__":
    # Create storage dir if needed for the test (mocked usually for FileSystemStorage but let's see)
    # The FileSystemStorage uses env var or default. 
    # Since we are using TestClient, it runs in process.
    # We should ensure we don't pollute real storage.
    # But for a quick reproduction, failing on file write is okay as long as we pass validation if the issue is validation.
    # Actually, the issue is expected to be BEFORE storage save, at parameter parsing.
    
    test_upload_bug()
    test_upload_fix()

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
from sqlmodel.pool import StaticPool
from app.models import SQLModel

# Use an in-memory DB for testing
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
        user = create_user(session, "Auth Test User")
        device_session, token = create_session(session, user.id, "Auth Test Device")
        print(f"Created User: {user.id}")
        print(f"Created Session for token: {token}")
        return token

def test_auth_endpoints():
    print("\n--- Testing Auth Endpoints ---")
    token = setup_auth()
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Test GET /api/items (Requires Auth)
    print("\n[TEST] GET /api/items")
    response = client.get("/api/items", headers=headers)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        print("SUCCESS: Authenticated request to /api/items passed.")
    else:
        print(f"FAILURE: Authenticated request to /api/items failed. Body: {response.json()}")

    # 2. Test POST /api/upload/finalize (Requires Auth)
    print("\n[TEST] POST /api/upload/finalize")
    
    # Mock data as if S3 upload finished
    data = {
        "original_filename": "test_auth.txt",
        "storage_path": "mock/path/test_auth.txt",
        "metadata": "{}"
    }
    
    response = client.post("/api/upload/finalize", data=data, headers=headers)
    print(f"Status: {response.status_code}")
    # Note: It might fail if S3 storage is trying to access S3 to verify existance? 
    # But usually finalize just records it in DB.
    # checking api.py finalize_upload -> item_service.finalize_upload -> does it notify?
    
    if response.status_code == 200:
        print("SUCCESS: Authenticated request to /api/upload/finalize passed.")
    else:
        print(f"FAILURE: Authenticated request to /api/upload/finalize failed. Body: {response.json()}")

    # 3. Test GET /api/auth/sessions
    print("\n[TEST] GET /api/auth/sessions")
    response = client.get("/api/auth/sessions", headers=headers)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        sessions = response.json()
        print(f"SUCCESS: Retrieved {len(sessions)} sessions.")
        if len(sessions) > 0:
            print(f"First session ID: {sessions[0]['id']}")
    else:
        print(f"FAILURE: GET /api/auth/sessions failed. Body: {response.json()}")

    # 4. Test DELETE /api/auth/sessions/{id}
    # We will try to delete the CURRENT session.
    # First get the session ID we just created in setup_auth
    # Actually setup_auth doesn't return the session object.
    # But GET /sessions returned it.
    
    if response.status_code == 200 and len(response.json()) > 0:
        session_id = response.json()[0]['id']
        print(f"\n[TEST] DELETE /api/auth/sessions/{session_id}")
        
        del_response = client.delete(f"/api/auth/sessions/{session_id}", headers=headers)
        print(f"Status: {del_response.status_code}")
        
        if del_response.status_code == 200:
            print("SUCCESS: Session revoked.")
            
            # Verify we can no longer use this token?
            # Actually our get_current_user implementation checks checks is_active.
            print("\n[TEST] Verify Token Invalidated")
            verify_response = client.get("/api/items", headers=headers)
            print(f"Status: {verify_response.status_code} (Expect 401)")
            if verify_response.status_code == 401:
                print("SUCCESS: Token is now invalid.")
            else:
                 print(f"FAILURE: Token should be invalid but got {verify_response.status_code}")
        else:
             print(f"FAILURE: Could not revoke session. Body: {del_response.json()}")

if __name__ == "__main__":
    test_auth_endpoints()

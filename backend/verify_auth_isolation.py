import httpx
import uuid
from sqlmodel import Session, select
from app.models import engine, User
from app.services.auth import create_user, create_session
import sys

BASE_URL = "http://localhost:8000/api"

def get_or_create_token(name: str) -> str:
    with Session(engine) as session:
        user = session.exec(select(User).where(User.display_name == name)).first()
        if not user:
            print(f"Creating user {name}...")
            user = create_user(session, name)
        
        # Create session
        _, token = create_session(session, user.id, "Test Device")
        return token

def verify_isolation():
    print("=== Verifying Data Isolation ===")
    
    # 1. Setup Users
    token_a = get_or_create_token("UserA")
    token_b = get_or_create_token("UserB")
    
    client_a = httpx.Client(base_url=BASE_URL, headers={"Authorization": f"Bearer {token_a}"})
    client_b = httpx.Client(base_url=BASE_URL, headers={"Authorization": f"Bearer {token_b}"})
    
    # 2. User A Uploads Item
    print("\n[A] Uploading item...")
    files = {'file': ('iso_test.txt', b'User A Private Data')}
    resp = client_a.post("/upload", files=files)
    if resp.status_code != 200:
        print(f"Upload failed: {resp.text}")
        sys.exit(1)
    
    item_a = resp.json()
    item_id = item_a['id']
    print(f"[A] Item created: {item_id}")
    
    # 3. User B Lists Items
    print("\n[B] Listing items (Expect Empty)...")
    resp = client_b.get("/items")
    items = resp.json()
    print(f"[B] Items found: {len(items)}")
    
    if len(items) != 0:
        print("FAIL: User B saw items!")
        # Check if it was User A's item
        for i in items:
            if i['id'] == item_id:
                print("FATAL: User B saw User A's item!")
        sys.exit(1)
    else:
        print("PASS: User B saw 0 items.")

    # 4. User B gets specific item
    print(f"\n[B] Getting specific item {item_id} (Expect 404)...")
    resp = client_b.get(f"/items/{item_id}/download")
    print(f"[B] Status: {resp.status_code}")
    
    if resp.status_code != 404:
        print(f"FAIL: User B accessed item! Status: {resp.status_code}")
        sys.exit(1)
    else:
        print("PASS: User B got 404.")

    # 5. User A Search
    print("\n[A] Searching 'iso' (Expect 1)...")
    resp = client_a.get("/search", params={"q": "iso"})
    results = resp.json()
    print(f"[A] Found: {len(results['items'])}")
    if len(results['items']) == 0:
         print("FAIL: User A could not find their own item via search.")
         sys.exit(1)

    # 6. User B Search
    print("\n[B] Searching 'iso' (Expect 0)...")
    resp = client_b.get("/search", params={"q": "iso"})
    results = resp.json()
    print(f"[B] Found: {len(results['items'])}")
    if len(results['items']) > 0:
         print("FAIL: User B found User A's item via search!")
         sys.exit(1)
    else:
        print("PASS: User B found nothing.")

    print("\n" + "="*50)
    print("SUCCESS: DATA ISOLATION VERIFIED")
    print("="*50)

if __name__ == "__main__":
    verify_isolation()

# Authentication Implementation Guide (Family Server)

This guide provides step-by-step instructions for implementing the **Multi-User Family Server** with Passwordless Device Pairing.

## Phase 1: Backend Implementation

### Step 1: Install Dependencies
Add to `backend/requirements.txt`:
```text
qrcode[pil]
```

### Step 2: Database Models & Migration (`app/models.py`)
1.  **Define `User`, `Session`, `Invite`, `InviteType`** as designed.
2.  **Add `owner_id`** to `ContentItem`, `Tag`, `ProcessingTask`.
3.  **Migration Strategy**:
    *   Since this is a new feature, `SQLModel.metadata.create_all()` will handle new tables.
    *   *Self-hosted migration note*: If an existing DB has items without `owner_id`, the startup logic should assign them to the first Admin User created.

### Step 3: Auth Logic (`app/services/auth.py`)
*   `generate_token()`, `hash_token()`.
*   `get_current_user` dependency:
    *   Find Session -> Verify Active.
    *   Return Session.User.

### Step 4: Endpoints (`app/api/auth.py`)

#### Invite Logic
```python
@router.post("/invite/device")
def invite_device(current_user: User = Depends(get_current_user)):
    # Create InviteType.NEW_DEVICE linked to current_user.id
    return {"code": ...}

@router.post("/invite/user")
def invite_user(new_user_name: str, current_user: User = Depends(get_current_user)):
    if not current_user.is_admin: raise 403
    # Create new User(name=new_user_name)
    # Create InviteType.NEW_DEVICE linked to NEW user's ID
    return {"code": ...}
```

#### Join Logic
```python
@router.post("/join")
def join(code: str, device_name: str):
    # Find Invite
    # If NEW_DEVICE:
        # Create Session(user_id=invite.target_user_id)
    # (Note: NEW_USER logic is handled at invite time by pre-creating the user)
    return {"token": ..., "user": ...}
```

### Step 5: Admin Bootstrap (Startup)
In `app/main.py`: `startup` event.
1.  Check if `User` table is empty.
2.  If empty:
    *   Create `User(display_name="Admin", is_admin=True)`.
    *   Create `Session` for this user.
    *   Print Session Token to Console.

## Phase 2: Frontend Implementation

### Step 1: Login
*   Paste Token.
*   Or "Join via Code" (Mobile flow).

### Step 2: React Context (`AuthContext`)
*   Store `user` object `{id, displayName, isAdmin}` alongside `token`.

### Step 3: Admin UI
*   If `user.isAdmin`, show "Manage Users" in settings.
*   "Add Family Member":
    1.  Ask for Name ("Mom").
    2.  Call `/invite/user`.
    3.  Display QR Code.
    4.  Mom scans code -> She is logged in as "Mom".

## Phase 3: Data Isolation Refactor
*   **Audit all CRUD**:
    *   Go through `app/api/*.py`.
    *   Ensure every query has `.where(Model.owner_id == current_user.id)`.

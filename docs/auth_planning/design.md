# Authentication & Encryption Design (Family Server)

## 1. Overview
This design implements the **Multi-User Family Server**. It re-introduces `User` as an aggregation of `Sessions` and the owner of data.

## 2. Data Model Design

### 2.1 New Table: `User`
Tracks the human identity.

```python
class User(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    display_name: str = Field(index=True) # e.g. "Dad"
    is_admin: bool = Field(default=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    sessions: list["Session"] = Relationship(back_populates="user")
```

### 2.2 Updated Table: `Session`
Tracks authorized devices, linked to a User.

```python
class Session(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", index=True)
    token_hash: str = Field(index=True)
    name: str # e.g., "Dad's iPhone"
    
    created_at: datetime
    last_used_at: datetime
    is_active: bool
    
    user: User = Relationship(back_populates="sessions")
```

### 2.3 Updated Table: `Invite`
We need to know *what* we are inviting someone to join.

```python
class InviteType(str, Enum):
    NEW_DEVICE = "NEW_DEVICE" # Adds device to Current User
    NEW_USER = "NEW_USER"     # Creates a new User

class Invite(SQLModel, table=True):
    code: str = Field(primary_key=True)
    invite_type: InviteType
    created_by_user_id: uuid.UUID
    target_user_id: Optional[uuid.UUID] = None # Set if invite_type is NEW_DEVICE (the user to attach to)
    expires_at: datetime
```

### 2.4 Content Models (Isolation)
Every business model (`ContentItem`, `Tag`, `ProcessingTask`) must have:

```python
owner_id: uuid.UUID = Field(foreign_key="user.id", index=True)
```

## 3. API Design

### 3.1 Invite Endpoints

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/invite/device` | Generates code to add device to *current user*. | Yes (Any User) |
| `POST` | `/api/auth/invite/user` | Generates code to create *new user*. Body: `{display_name: "Mom"}`. | Yes (Admin Only) |
| `POST` | `/api/auth/join` | Consumes code. Returns `{token, user: {id, name}}`. | No |

### 3.2 Management Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/users` | List all users. |
| `GET` | `/api/auth/sessions` | List sessions for *current user*. |

## 4. Security & Isolation logic
*   **Application-Level Isolation**:
    *   `get_current_user` dependency returns the full `User` object.
    *   CRUD Services (e.g., `get_items`) **MUST** accept `user: User`.
    *   Query: `query.where(ContentItem.owner_id == user.id)`.

## 5. Frontend Implications
*   **"Am I Admin?"**: Frontend state needs to know `currentUser.isAdmin` to show "Invite User" buttons.
*   **Profile Switcher?**: Not needed. Each device is bound to one user. To "switch profiles", you would log out and scan a different invite code (rare for personal devices).

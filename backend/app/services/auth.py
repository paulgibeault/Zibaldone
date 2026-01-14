from sqlmodel import Session, select
from app.models import User, Session as UserSession, ContentItem, Tag, ProcessingTask
import secrets
import uuid
import hashlib
from datetime import datetime, timezone

def get_token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()

def verify_token(plain_token, hashed_token):
    return get_token_hash(plain_token) == hashed_token

def create_user(session: Session, display_name: str, is_admin: bool = False) -> User:
    user = User(display_name=display_name, is_admin=is_admin)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user

def create_session(session: Session, user_id: uuid.UUID, name: str) -> tuple[UserSession, str]:
    token = secrets.token_urlsafe(32)
    token_hash = get_token_hash(token)
    device_session = UserSession(
        user_id=user_id,
        token_hash=token_hash,
        name=name,
        created_at=datetime.now(timezone.utc),
        last_used_at=datetime.now(timezone.utc),
        is_active=True
    )
    session.add(device_session)
    session.commit()
    session.refresh(device_session)
    return device_session, token

def bootstrap_auth(session: Session):
    # Check if any user exists
    user = session.exec(select(User)).first()
    if not user:
        print("\n\n" + "="*50)
        print("BOOTSTRAP: Creating Initial Admin User")
        user = create_user(session, "Admin", is_admin=True)
        
        print("Admin user created.")
        print("Run 'python backend/reset_admin.py' (or use the helper script) to generate an admin token.")
        print("="*50 + "\n\n")

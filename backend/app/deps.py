from fastapi import Depends, status
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import Session, select
from app.models import get_session, User, Session as UserSession
from app.services.auth import get_token_hash
from datetime import datetime, timezone
from app.exceptions import AuthenticationError, PermissionError

# We use auto_error=False to allow optional auth (for now) or manual handling
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/token", auto_error=False)

def get_current_user_optional(
    token: str | None = Depends(oauth2_scheme),
    session: Session = Depends(get_session)
) -> User | None:
    if not token:
        return None
    
    token_hash = get_token_hash(token)
    
    # Find session
    statement = select(UserSession).where(UserSession.token_hash == token_hash)
    user_session = session.exec(statement).first()
    
    if not user_session:
        return None
        
    if not user_session.is_active:
        return None
        
    # Update last_used_at
    # optimized to avoid writing on every single read? 
    # For now, let's just update it.
    user_session.last_used_at = datetime.now(timezone.utc)
    session.add(user_session)
    session.commit()
    session.refresh(user_session)
    
    return user_session.user

def get_current_user(
    user: User | None = Depends(get_current_user_optional)
) -> User:
    if not user:
        raise AuthenticationError("Not authenticated")
    return user

def get_current_admin_user(
    user: User = Depends(get_current_user)
) -> User:
    if not user.is_admin:
        raise PermissionError("The user doesn't have enough privileges")
    return user

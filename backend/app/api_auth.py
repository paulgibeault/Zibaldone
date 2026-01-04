from fastapi import APIRouter, Depends, HTTPException, Body
from sqlmodel import Session, select
from datetime import datetime, timedelta, timezone
import secrets
import uuid

from app.models import get_session, User, Invite, InviteType
from app import schemas
from app.services.auth import create_session, create_user
from app.deps import get_current_user, get_current_admin_user

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/invite/device")
def invite_device(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Generate an invite code to add a device to the current user.
    """
    code = secrets.token_urlsafe(16) # Magic Link / QR Code payload
    invite = Invite(
        code=code,
        invite_type=InviteType.NEW_DEVICE,
        created_by_user_id=current_user.id,
        target_user_id=current_user.id,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=15) # 15 min expiry
    )
    session.add(invite)
    session.commit()
    return {"code": code, "expires_at": invite.expires_at}

@router.post("/invite/user")
def invite_user(
    display_name: str = Body(..., embed=True),
    current_user: User = Depends(get_current_admin_user),
    session: Session = Depends(get_session)
):
    """
    Create a new user and generate an invite code for them.
    (Admin only)
    """
    # Create the user immediately
    new_user = create_user(session, display_name, is_admin=False)
    
    code = secrets.token_urlsafe(16)
    invite = Invite(
        code=code,
        invite_type=InviteType.NEW_USER, # Although we treat it as NEW_DEVICE for that user effectively
        created_by_user_id=current_user.id,
        target_user_id=new_user.id,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24) # Longer expiry for user invite
    )
    session.add(invite)
    session.commit()
    
    return {"code": code, "user_id": new_user.id, "expires_at": invite.expires_at}

@router.post("/join")
def join(
    code: str = Body(..., embed=True),
    device_name: str = Body(..., embed=True),
    session: Session = Depends(get_session)
):
    """
    Exchange an invite code for a session token.
    """
    invite = session.exec(select(Invite).where(Invite.code == code)).first()
    
    if not invite:
        raise HTTPException(status_code=404, detail="Invalid invite code")
        
    expires_at = invite.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
        
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Invite expired")
        
    if not invite.target_user_id:
        raise HTTPException(status_code=500, detail="Corrupt invite: no target user")
        
    # Create session
    device_session, token = create_session(session, invite.target_user_id, device_name)
    
    # Consume invite (Delete it)
    session.delete(invite)
    session.commit()
    
    # Return token and user info
    # We need to fetch user to return it
    user = session.get(User, invite.target_user_id)
    
    return {
        "token": token,
        "user": {
            "id": user.id,
            "display_name": user.display_name,
            "is_admin": user.is_admin,
            "profile_color": user.profile_color
        }
    }

@router.get("/me", response_model=schemas.UserRead)
def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.put("/me", response_model=schemas.UserRead)
def update_user_me(
    user_update: schemas.UserUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    if user_update.display_name is not None:
        current_user.display_name = user_update.display_name
    if user_update.profile_color is not None:
        current_user.profile_color = user_update.profile_color
    
    session.add(current_user)
    session.commit()
    session.refresh(current_user)
    return current_user

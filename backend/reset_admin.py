from sqlmodel import Session, select
from app.models import engine, User
from app.services.auth import create_session, create_user
import sys

def reset_admin():
    with Session(engine) as session:
        user = session.exec(select(User).where(User.is_admin == True)).first()
        
        if not user:
            print("No Admin user found. Creating one...")
            user = create_user(session, "Admin", is_admin=True)
        else:
            print(f"Found Admin user: {user.display_name} ({user.id})")
            
        device_session, token = create_session(session, user.id, "Emergency Recovery Token")
        print("\n" + "="*50)
        print(f"NEW ADMIN TOKEN: {token}")
        print("="*50 + "\n")

if __name__ == "__main__":
    reset_admin()

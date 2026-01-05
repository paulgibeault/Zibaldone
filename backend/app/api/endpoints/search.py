from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.deps import get_current_user
from app.models import User, get_session
from app import crud, schemas
from app.services import item_service

router = APIRouter()

@router.get("/search", response_model=schemas.SearchResponse)
def search_content(
    q: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    results = crud.search_content(session, q, current_user.id)
    # enrich items
    results["items"] = [item_service.enrich_item(item) for item in results["items"]]
    return results

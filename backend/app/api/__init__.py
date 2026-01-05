from fastapi import APIRouter
from app.api.endpoints import items, tags, auth, upload, search

router = APIRouter()

router.include_router(items.router)
router.include_router(tags.router)
router.include_router(auth.router)
router.include_router(upload.router)
router.include_router(search.router)

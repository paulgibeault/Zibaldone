from fastapi import APIRouter
from app.api.endpoints import items, tags, auth, upload, search, tasks, skills, notebooks

router = APIRouter()

router.include_router(items.router)
router.include_router(tags.router)
router.include_router(auth.router)
router.include_router(upload.router)
router.include_router(search.router)
router.include_router(tasks.router)
router.include_router(skills.router)
router.include_router(notebooks.router)

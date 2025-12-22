from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import router as api_router
from contextlib import asynccontextmanager
from app.models import create_db_and_tables
from app.workers import process_unprocessed_items
import asyncio

@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    # Start the background worker
    asyncio.create_task(process_unprocessed_items())
    yield

app = FastAPI(title="Zibaldone", lifespan=lifespan)

# CORS - Allow all for local development convenience
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")

@app.get("/")
def read_root():
    return {"message": "Welcome to Zibaldone"}

from fastapi.responses import StreamingResponse
from app.services.event_broadcaster import broadcaster
import json

@app.get("/api/events")
async def sse_endpoint():
    async def event_generator():
        queue = await broadcaster.subscribe()
        try:
            while True:
                data = await queue.get()
                yield f"data: {data}\n\n"
        except asyncio.CancelledError:
            broadcaster.unsubscribe(queue)
            
    return StreamingResponse(event_generator(), media_type="text/event-stream")


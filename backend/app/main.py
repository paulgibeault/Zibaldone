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
    
    # Ensure S3 CORS is configured if using S3
    from app.services.storage import get_storage
    from app.services.s3_storage import S3Storage
    storage = get_storage()
    if isinstance(storage, S3Storage):
        try:
            print(f"Configuring CORS for bucket: {storage.bucket_name}")
            storage.s3_client.put_bucket_cors(
                Bucket=storage.bucket_name,
                CORSConfiguration={
                    'CORSRules': [
                        {
                            'AllowedHeaders': ['*'],
                            'AllowedMethods': ['PUT', 'POST', 'GET', 'DELETE'],
                            'AllowedOrigins': ['*'], # In production, this should be restricted
                            'ExposeHeaders': ['ETag'],
                            'MaxAgeSeconds': 3000
                        }
                    ]
                }
            )
            print("Successfully configured CORS")
        except Exception as e:
            print(f"Warning: Failed to configure S3 CORS: {e}")

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


from typing import List
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.models import get_session, Notebook, ContentItem, ContentItemNotebookLink, User, NotebookTask
from app.schemas import NotebookCreate, NotebookRead, NotebookUpdate, NotebookReadWithItems, NotebookAddItems, NotebookTaskCreate, NotebookTaskRead, NotebookTaskUpdate, NotebookChatRequest, NotebookChatResponse
from app.api.endpoints.auth import get_current_user
from app.services.llm import LLMService

router = APIRouter(
    prefix="/notebooks",
    tags=["notebooks"],
    responses={404: {"description": "Not found"}},
)

@router.post("/", response_model=NotebookRead)
def create_notebook(
    notebook: NotebookCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    db_notebook = Notebook.from_orm(notebook)
    db_notebook.owner_id = current_user.id
    session.add(db_notebook)
    session.commit()
    session.refresh(db_notebook)
    return db_notebook

@router.get("/", response_model=List[NotebookRead])
def read_notebooks(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    # Retrieve notebooks owned by current user
    # Or should we allow shared notebooks? For now, just owner.
    statement = select(Notebook).where(Notebook.owner_id == current_user.id).order_by(Notebook.updated_at.desc())
    results = session.exec(statement)
    return results.all()

from app.services import item_service

@router.get("/{notebook_id}", response_model=NotebookReadWithItems)
def read_notebook(
    notebook_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    notebook = session.get(Notebook, notebook_id)
    if not notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")
    if notebook.owner_id != current_user.id:
         raise HTTPException(status_code=403, detail="Not authorized to access this notebook")
    
    # Enrich items to include download_url and other computed fields
    enriched_items = [item_service.enrich_item(item) for item in notebook.items]
    
    # Construct response manually to ensure items are enriched
    response = NotebookReadWithItems.from_orm(notebook)
    response.items = enriched_items
    return response

@router.patch("/{notebook_id}", response_model=NotebookReadWithItems)
def update_notebook(
    notebook_id: uuid.UUID,
    notebook_update: NotebookUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    db_notebook = session.get(Notebook, notebook_id)
    if not db_notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")
    if db_notebook.owner_id != current_user.id:
         raise HTTPException(status_code=403, detail="Not authorized to update this notebook")

    notebook_data = notebook_update.dict(exclude_unset=True)
    for key, value in notebook_data.items():
        setattr(db_notebook, key, value)
    
    db_notebook.updated_at = datetime.now(timezone.utc)
    session.add(db_notebook)
    session.commit()
    session.refresh(db_notebook)

    enriched_items = [item_service.enrich_item(item) for item in db_notebook.items]
    response = NotebookReadWithItems.from_orm(db_notebook)
    response.items = enriched_items
    return response

@router.delete("/{notebook_id}")
def delete_notebook(
    notebook_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    db_notebook = session.get(Notebook, notebook_id)
    if not db_notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")
    if db_notebook.owner_id != current_user.id:
         raise HTTPException(status_code=403, detail="Not authorized to delete this notebook")
    
    # Manually delete links first (if cascade is not handling it or to be safe)
    statement = select(ContentItemNotebookLink).where(ContentItemNotebookLink.notebook_id == notebook_id)
    links = session.exec(statement).all()
    for link in links:
        session.delete(link)
    
    session.delete(db_notebook)
    session.commit()
    return {"ok": True}

@router.post("/{notebook_id}/items", response_model=NotebookReadWithItems)
def add_items_to_notebook(
    notebook_id: uuid.UUID,
    payload: NotebookAddItems,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    db_notebook = session.get(Notebook, notebook_id)
    if not db_notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")
    if db_notebook.owner_id != current_user.id:
         raise HTTPException(status_code=403, detail="Not authorized to modify this notebook")

    for item_id in payload.item_ids:
        # Verify item exists
        item = session.get(ContentItem, item_id)
        if not item:
            continue 
            
        # Check if already linked
        existing_link = session.exec(
            select(ContentItemNotebookLink)
            .where(ContentItemNotebookLink.notebook_id == notebook_id)
            .where(ContentItemNotebookLink.item_id == item_id)
        ).first()

        if not existing_link:
            # Explicitly create link
            link = ContentItemNotebookLink(notebook_id=notebook_id, item_id=item_id)
            session.add(link)
    
    session.commit()
    session.refresh(db_notebook)

    enriched_items = [item_service.enrich_item(item) for item in db_notebook.items]
    response = NotebookReadWithItems.from_orm(db_notebook)
    response.items = enriched_items
    return response

@router.delete("/{notebook_id}/items/{item_id}", response_model=NotebookReadWithItems)
def remove_item_from_notebook(
    notebook_id: uuid.UUID,
    item_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    db_notebook = session.get(Notebook, notebook_id)
    if not db_notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")
    if db_notebook.owner_id != current_user.id:
         raise HTTPException(status_code=403, detail="Not authorized to modify this notebook")

    link = session.exec(
            select(ContentItemNotebookLink)
            .where(ContentItemNotebookLink.notebook_id == notebook_id)
            .where(ContentItemNotebookLink.item_id == item_id)
        ).first()
        
    if link:
        session.delete(link)
        db_notebook.updated_at = datetime.now(timezone.utc)
        session.add(db_notebook)
        session.commit()
        session.refresh(db_notebook)
        
    enriched_items = [item_service.enrich_item(item) for item in db_notebook.items]
    response = NotebookReadWithItems.from_orm(db_notebook)
    response.items = enriched_items
    return response

# --- Notebook Task Endpoints ---

@router.post("/{notebook_id}/tasks", response_model=NotebookTaskRead)
def create_notebook_task(
    notebook_id: uuid.UUID,
    task_create: NotebookTaskCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    db_notebook = session.get(Notebook, notebook_id)
    if not db_notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")
    if db_notebook.owner_id != current_user.id:
         raise HTTPException(status_code=403, detail="Not authorized")
    
    # Ensure notebook_id matches route
    if task_create.notebook_id != notebook_id:
        raise HTTPException(status_code=400, detail="Notebook ID mismatch")
        
    db_task = NotebookTask.from_orm(task_create)
    session.add(db_task)
    session.commit()
    session.refresh(db_task)
    return db_task

@router.get("/{notebook_id}/tasks", response_model=List[NotebookTaskRead])
def read_notebook_tasks(
    notebook_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    db_notebook = session.get(Notebook, notebook_id)
    if not db_notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")
    if db_notebook.owner_id != current_user.id:
         raise HTTPException(status_code=403, detail="Not authorized")
         
    statement = select(NotebookTask).where(NotebookTask.notebook_id == notebook_id)
    return session.exec(statement).all()

@router.patch("/{notebook_id}/tasks/{task_id}", response_model=NotebookTaskRead)
def update_notebook_task(
    notebook_id: uuid.UUID,
    task_id: uuid.UUID,
    task_update: NotebookTaskUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    db_notebook = session.get(Notebook, notebook_id)
    if not db_notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")
    if db_notebook.owner_id != current_user.id:
         raise HTTPException(status_code=403, detail="Not authorized")
         
    db_task = session.get(NotebookTask, task_id)
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    if db_task.notebook_id != notebook_id:
        raise HTTPException(status_code=404, detail="Task not in this notebook")
        
    task_data = task_update.dict(exclude_unset=True)
    for key, value in task_data.items():
        setattr(db_task, key, value)
        
    session.add(db_task)
    session.commit()
    session.refresh(db_task)
    return db_task

@router.delete("/{notebook_id}/tasks/{task_id}")
def delete_notebook_task(
    notebook_id: uuid.UUID,
    task_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    db_notebook = session.get(Notebook, notebook_id)
    if not db_notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")
    if db_notebook.owner_id != current_user.id:
         raise HTTPException(status_code=403, detail="Not authorized")
         
    db_task = session.get(NotebookTask, task_id)
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    session.delete(db_task)
    session.commit()
    return {"ok": True}

# --- Chat Endpoint ---

@router.post("/{notebook_id}/chat", response_model=NotebookChatResponse)
async def chat_notebook(
    notebook_id: uuid.UUID,
    payload: NotebookChatRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    db_notebook = session.get(Notebook, notebook_id)
    if not db_notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")
    if db_notebook.owner_id != current_user.id:
         raise HTTPException(status_code=403, detail="Not authorized")
    
    # Init LLM
    llm = LLMService() 

    # Fetch context items
    context_item_dicts = []
    if payload.context_item_ids:
        for item_id in payload.context_item_ids:
            item = session.get(ContentItem, item_id)
            # Ensure item exists and user owns it
            if item and (item.owner_id == current_user.id or item.owner_id is None): 
                 context_item_dicts.append({
                     "storage_path": item.storage_path,
                     "original_filename": item.original_filename
                 })
    
    # Message history
    chat_messages = [{"role": msg.role, "content": msg.content} for msg in payload.chat_history]
    # Add current message
    chat_messages.append({"role": "user", "content": payload.message})
    
    try:
        result = await llm.chat_with_context(chat_messages, context_item_dicts)
        response_text = result["content"]
        debug_info = result.get("debug_info")
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))
    
    return NotebookChatResponse(response=response_text, debug_info=debug_info)

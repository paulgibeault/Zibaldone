import uuid
from sqlmodel import Session, select
from sqlalchemy.orm import selectinload, aliased
from sqlalchemy import or_
from app.models import ContentItem, Tag

def search_content(session: Session, query: str, owner_id: uuid.UUID) -> dict:
    terms = query.strip().split()
    if not terms:
        return {"tags": [], "items": []}
    
    # helper to build LIKE clause
    def build_like(column, term):
        return column.ilike(f"%{term}%")

    # Tags: Match ANY term
    tag_conditions = [build_like(Tag.name, term) for term in terms]
    tag_statement = select(Tag).where(or_(*tag_conditions)).where(Tag.is_approved == True).where(Tag.owner_id == owner_id)
    tags = session.exec(tag_statement).all()
    
    # Items: Match ALL terms across fields
    # For each term, it must be in (original_filename OR metadata_json)
    # This matches the intuition of "invoice 2024" finding "invoice.pdf" with "2024" in metadata
    item_statement = select(ContentItem).where(ContentItem.owner_id == owner_id).options(
        selectinload(ContentItem.tags),
        selectinload(ContentItem.tasks)
    )
    
    for term in terms:
        # Each term must be present in at least one of these columns
        term_condition = or_(
            build_like(ContentItem.original_filename, term),
            build_like(ContentItem.metadata_json, term)
        )
        item_statement = item_statement.where(term_condition)
        
    # Exclude newer versions (similar to get_items logic)
    c2 = aliased(ContentItem)
    subquery = (
        select(1)
        .where(c2.original_filename == ContentItem.original_filename)
        .where(c2.version > ContentItem.version)
    )
    item_statement = item_statement.where(~subquery.exists())
    
    items = session.exec(item_statement).all()
    
    return {"tags": tags, "items": items}

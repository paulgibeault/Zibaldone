from app.services.skill_sdk import SkillContext, SkillResult
from app.services.llm import LLMService
from app import crud
import os
import asyncio

async def run(ctx: SkillContext) -> SkillResult:
    # 1. Get current tags from metadata
    metadata = ctx.get_metadata()
    tags = metadata.get('tags', [])
    
    if not tags or not isinstance(tags, list):
        return ctx.no_change("No tags to align")

    # 2. Get existing approved tags from DB (Sync -> Async wrap)
    def fetch_tags():
        return crud.get_tags(ctx.session, owner_id=ctx.item.owner_id, approved_only=True)
    
    all_tags = await asyncio.to_thread(fetch_tags)
    existing_tag_names = [t.name for t in all_tags]
    
    if not existing_tag_names:
        # Just ensure they are linked
        aligned_tags = tags
    else:
        # Align
        llm_service = LLMService() # Default model
        aligned_tags = await llm_service.align_tags(tags, existing_tag_names)
    
    # 3. Link tags to item
    # This mimics the original worker logic which ensures tags exist and are linked
    # We must wrap these sync DB ops too.
    for tag_name in aligned_tags:
        if not tag_name:
            continue
            
        def process_tag(t_name):
            tag = crud.get_tag_by_name(ctx.session, t_name, owner_id=ctx.item.owner_id)
            if not tag:
                 tag = crud.create_tag(
                     ctx.session, 
                     name=t_name, 
                     owner_id=ctx.item.owner_id, 
                     color="#888888",
                     is_autocreated=True, 
                     is_approved=False
                 )
            return tag

        tag = await asyncio.to_thread(process_tag, tag_name)
        
        if tag not in ctx.item.tags:
            ctx.item.tags.append(tag)
            
    # 4. Update metadata if changed
    if aligned_tags != tags:
        return ctx.update_metadata({"tags": aligned_tags}, message="Tags aligned and linked")
        
    return ctx.no_change("Tags verified and linked")

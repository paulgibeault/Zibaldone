
def _is_fuzzy_match(hash1: Optional[str], hash2: Optional[str], threshold: int = 100) -> bool:
    if not hash1 or not hash2:
        return False
    try:
        import tlsh
        score = tlsh.diff(hash1, hash2)
        logger.info(f"TLSH Score: {score} (Threshold: {threshold}) -> {'MATCH' if score < threshold else 'MISMATCH'}")
        return score < threshold
    except ImportError:
        logger.warning("TLSH not installed, cannot compare.")
        return False
    except Exception as e:
        logger.error(f"TLSH comparison error: {e}")
        return False

def calculate_next_version(
    session: Session, 
    filename: str, 
    owner_id: uuid.UUID, 
    client_file_path: Optional[str] = None, 
    signature: Optional[str] = None,
    tlsh_hash: Optional[str] = None,
    resolution: Optional[str] = None
) -> tuple[int, Optional[ContentItem]]:
    
    if resolution == 'new_file':
        return 1, None

    # Find candidates - start broad with filename and owner
    statement = select(ContentItem)\
        .where(ContentItem.original_filename == filename)\
        .where(ContentItem.owner_id == owner_id)\
        .where(ContentItem.is_latest == True)
        
    candidates = session.exec(statement).all()
    latest_candidate: Optional[ContentItem] = None
    
    # Filter for path match
    for c in candidates:
        if c.client_file_path == client_file_path:
             latest_candidate = c
             break
        # Implicit match
        is_implicit_req = not client_file_path or client_file_path == filename
        is_implicit_cand = not c.client_file_path or c.client_file_path == filename
        if is_implicit_req and is_implicit_cand:
             latest_candidate = c
             break
             
    if not latest_candidate:
        return 1, None
        
    if resolution == 'new_version':
        return latest_candidate.version + 1, latest_candidate

    # Identity Checks
    meta = latest_candidate.metadata or {}
    latest_sig = meta.get("client_context", {}).get("signature")
    latest_tlsh = meta.get("tlsh")
    
    if latest_sig and signature:
        if latest_sig != signature:
             if _is_fuzzy_match(latest_tlsh, tlsh_hash):
                 return latest_candidate.version + 1, latest_candidate
             else:
                 raise IdentityConflictError(
                     message=f"File '{filename}' already exists but looks different.",
                     details={"filename": filename}
                 )
        else:
             if tlsh_hash and latest_tlsh:
                 if not _is_fuzzy_match(latest_tlsh, tlsh_hash):
                      raise IdentityConflictError(
                          message=f"File '{filename}' has matching header but different content.",
                          details={"filename": filename}
                      )
                      
    return latest_candidate.version + 1, latest_candidate

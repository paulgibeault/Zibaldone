import React, { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { getItems, searchContent, ContentItem, addItemsToNotebook } from '../api';
import './Heap.css'; // Reusing some Heap styles for consistency if needed, or inline styles

interface AddFilesModalProps {
    isOpen: boolean;
    onClose: () => void;
    notebookId: string;
    existingItemIds: Set<string>; // To visually disable or exclude already added items
    onAdded: () => void;
}

export const AddFilesModal: React.FC<AddFilesModalProps> = ({ isOpen, onClose, notebookId, existingItemIds, onAdded }) => {
    const [filterText, setFilterText] = useState('');
    const [debouncedFilterText, setDebouncedFilterText] = useState('');
    const [items, setItems] = useState<ContentItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
    const [adding, setAdding] = useState(false);



    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedFilterText(filterText);
        }, 300);
        return () => clearTimeout(timer);
    }, [filterText]);

    // Fetch items
    useEffect(() => {
        const fetchItems = async () => {
            if (!isOpen) return;
            setLoading(true);
            try {
                let fetchedItems: ContentItem[] = [];
                if (debouncedFilterText.trim()) {
                    const results = await searchContent(debouncedFilterText);
                    fetchedItems = results.items;
                } else {
                    fetchedItems = await getItems();
                }
                // Filter out items already in the notebook if we want to hide them, 
                // OR just mark them as disabled. Let's mark them disabled/hidden in render.
                // Actually, filtering them out might be cleaner for the user?
                // "existingItemIds" comes from props.
                setItems(fetchedItems);
            } catch (error) {
                console.error("Failed to fetch items:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchItems();
    }, [debouncedFilterText, isOpen]);

    const toggleSelection = (itemId: string) => {
        if (existingItemIds.has(itemId)) return;
        
        const newSelected = new Set(selectedItemIds);
        if (newSelected.has(itemId)) {
            newSelected.delete(itemId);
        } else {
            newSelected.add(itemId);
        }
        setSelectedItemIds(newSelected);
    };

    const handleAdd = async () => {
        if (selectedItemIds.size === 0) return;
        setAdding(true);
        try {
            await addItemsToNotebook(notebookId, Array.from(selectedItemIds));
            onAdded();
            onClose();
            setSelectedItemIds(new Set());
            setFilterText('');
        } catch (error) {
            console.error("Failed to add items:", error);
            alert("Failed to add items to notebook.");
        } finally {
            setAdding(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ width: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                <div className="modal-header">
                    <h3>Add Files to Notebook</h3>
                    <button onClick={onClose} className="modal-close"><X size={20} /></button>
                </div>
                
                <div style={{ padding: '0 1.5rem 1rem' }}>
                    <div className="input-with-icon">
                        <Search size={16} className="input-icon" />
                        <input
                            type="text"
                            placeholder="Search files..."
                            value={filterText}
                            onChange={(e) => setFilterText(e.target.value)}
                            className="filter-input-subtle"
                            style={{ width: '100%' }}
                            autoFocus
                        />
                    </div>
                </div>

                <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '0 1.5rem 1.5rem' }}>
                    {loading ? (
                        <div className="loading-small">Loading...</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {items.length === 0 ? (
                                <p className="empty-msg">No files found.</p>
                            ) : (
                                items.map(item => {
                                    const isAlreadyAdded = existingItemIds.has(item.id);
                                    const isSelected = selectedItemIds.has(item.id);
                                    return (
                                        <div 
                                            key={item.id}
                                            onClick={() => toggleSelection(item.id)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                padding: '0.75rem',
                                                background: isSelected ? 'var(--surface-hover)' : 'var(--bg-card)',
                                                border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border-subtle)'}`,
                                                borderRadius: '6px',
                                                cursor: isAlreadyAdded ? 'default' : 'pointer',
                                                opacity: isAlreadyAdded ? 0.5 : 1
                                            }}
                                        >
                                            <div 
                                                style={{
                                                    width: '16px',
                                                    height: '16px',
                                                    border: `1px solid ${isSelected || isAlreadyAdded ? 'var(--primary)' : 'var(--text-muted)'}`,
                                                    borderRadius: '4px',
                                                    marginRight: '0.75rem',
                                                    background: isSelected || isAlreadyAdded ? 'var(--primary)' : 'transparent',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: 'white',
                                                    fontSize: '10px'
                                                }}
                                            >
                                                {(isSelected || isAlreadyAdded) && '✓'}
                                            </div>
                                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                                <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {item.original_filename}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                    {new Date(item.created_at).toLocaleDateString()}
                                                </div>
                                            </div>
                                            {isAlreadyAdded && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Added</span>}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>

                <div className="modal-actions" style={{ padding: '1.5rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                    <button onClick={onClose} className="btn-secondary">Cancel</button>
                    <button 
                        onClick={handleAdd} 
                        disabled={selectedItemIds.size === 0 || adding}
                        className="btn-primary"
                    >
                        {adding ? 'Adding...' : `Add Selected (${selectedItemIds.size})`}
                    </button>
                </div>
            </div>
        </div>
    );
};

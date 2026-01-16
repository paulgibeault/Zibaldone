import React, { useEffect, useState } from 'react';
import { ArrowLeft, Trash2, Plus, Pin } from 'lucide-react';
import { getNotebook, removeItemFromNotebook, deleteNotebook, updateNotebook } from '../api';
import { Notebook, ContentItem } from '../api/types';
import { FileCard } from './FileCard';
import './Notebooks.css'; // Shared styles
import { AddFilesModal } from './AddFilesModal';

interface NotebookDetailProps {
  notebookId: string;
  onBack: () => void;
}

export const NotebookDetail: React.FC<NotebookDetailProps> = ({ notebookId, onBack }) => {
  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  const fetchNotebook = async () => {
    setLoading(true);
    try {
        const data = await getNotebook(notebookId);
        setNotebook(data);
        setTitle(data.title);
        setDescription(data.description || '');
    } catch (error) {
        console.error("Failed to fetch notebook:", error);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotebook();
  }, [notebookId]);

  const handleUpdate = async () => {
      if (!notebook) return;
      // Only update if changed
      if (title === notebook.title && description === (notebook.description || '')) return;
      
      try {
          // Optimistically update local state if needed, but here we just wait for API
          const updated = await updateNotebook(notebookId, title, description);
          // Preserve items if backend doesn't return them (though we fixed backend to return them)
          setNotebook(prev => {
              if (!prev) return updated;
              return {
                  ...updated,
                  items: updated.items || prev.items
              };
          }); 
      } catch (error) {
          console.error("Failed to update notebook:", error);
          // Revert on error?
          fetchNotebook();
      }
  };

  const handleRemoveItem = async (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Remove this item from the notebook?")) return;
    
    try {
      await removeItemFromNotebook(notebookId, itemId);
      fetchNotebook(); // Refresh
      if (selectedItemId === itemId) setSelectedItemId(null);
    } catch (error) {
      console.error("Failed to remove item:", error);
      alert("Failed to remove item");
    }
  };
  
  const handleDeleteNotebook = async () => {
      if (!window.confirm("Are you sure you want to delete this notebook? Items will not be deleted.")) return;
      try {
          await deleteNotebook(notebookId);
          onBack();
      } catch (error) {
          console.error("Failed to delete notebook:", error);
          alert("Failed to delete notebook");
      }
  };

  if (loading && !notebook) return <div>Loading notebook...</div>;
  if (!notebook) return <div>Notebook not found.</div>;

  return (
    <div className="notebook-detail-container">
      <div className="notebook-header">
        <button onClick={onBack} className="back-button">
          <ArrowLeft size={20} />
          Back
        </button>
        <div className="notebook-title-section">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                <input 
                    className="notebook-title" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onBlur={handleUpdate}
                    style={{
                        background: 'transparent',
                        border: '1px solid transparent',
                        borderRadius: '4px',
                        padding: '0.2rem 0.5rem',
                        marginLeft: '-0.5rem', // Align with other text
                        width: '100%',
                        maxWidth: '600px',
                        outline: 'none',
                        transition: 'border-color 0.2s',
                    }} 
                    onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                    onMouseLeave={(e) => { if(document.activeElement !== e.target) e.target.style.borderColor = 'transparent'; }}
                    onMouseEnter={(e) => e.target.style.borderColor = 'var(--border-subtle)'}
                />
                
                <button 
                    onClick={() => setIsAddModalOpen(true)}
                    className="action-button-primary"
                    style={{ fontSize: '0.8rem', padding: '0.3rem 0.8rem', flexShrink: 0 }}
                >
                    <Plus size={14} /> Add Files
                </button>
            </div>
             <button onClick={handleDeleteNotebook} className="delete-notebook-btn" title="Delete Notebook">
                <Trash2 size={16} />
            </button>
        </div>
        
        <div className="notebook-description-container" style={{ margin: '0 0 1rem 0' }}>
            <textarea
                className="notebook-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={handleUpdate}
                placeholder="Add a description..."
                style={{
                    background: 'transparent',
                    border: '1px solid transparent',
                    borderRadius: '4px',
                    padding: '0.5rem',
                    marginLeft: '-0.5rem',
                    width: '100%',
                    maxWidth: '800px',
                    fontFamily: 'inherit',
                    resize: 'none', // vertical resize only?
                    minHeight: '60px',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                onMouseLeave={(e) => { if(document.activeElement !== e.target) e.target.style.borderColor = 'transparent'; }}
                onMouseEnter={(e) => e.target.style.borderColor = 'var(--border-subtle)'}
            />
        </div>

        <div className="notebook-meta">
            Created: {new Date(notebook.created_at).toLocaleDateString()} · {notebook.items?.length || 0} items
        </div>
      </div>

      <div className="notebook-content">
        <div className="files-grid-fixed">
          {notebook.items && notebook.items.length > 0 ? (
            notebook.items.map((item: ContentItem) => (
              <FileCard
                key={item.id}
                item={item}
                onDelete={(id, e) => handleRemoveItem(id, e)}
                onRefresh={fetchNotebook}
                isSelected={selectedItemId === item.id}
                onSelect={() => setSelectedItemId(item.id)}
                onDeselect={() => setSelectedItemId(null)}
                isPinned={false}
                onTogglePin={() => {}}
              />
            ))
          ) : (
            <div className="empty-notebook">
              <p>This notebook is empty.</p>
              <p>Click "Add Files" to search and add content to this notebook.</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Detail View for Selected Item */}
      {selectedItemId && (
           <div className="notebook-item-detail-overlay" onClick={() => setSelectedItemId(null)}>
                <div className="notebook-item-detail-content" onClick={e => e.stopPropagation()}>
                     {(() => {
                        const item = notebook.items?.find(i => i.id === selectedItemId);
                         if (!item) return null;
                         return (
                              <FileCard
                                  item={item}
                                  onDelete={(id, e) => handleRemoveItem(id, e)}
                                  onRefresh={fetchNotebook}
                                  isSelected={true}
                                  onSelect={() => {}}
                                  onDeselect={() => setSelectedItemId(null)}
                                  isPinned={false}
                                  onTogglePin={() => {}}
                              />
                         );
                     })()}
                </div>
           </div>
      )}
      
      <AddFilesModal 
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        notebookId={notebook.id}
        existingItemIds={new Set(notebook.items?.map(i => i.id))}
        onAdded={fetchNotebook}
      />
    </div>
  );
};

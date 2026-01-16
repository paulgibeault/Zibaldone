import React, { useState } from 'react';
import { X } from 'lucide-react';
import { createNotebook, addItemsToNotebook } from '../api';

interface CreateNotebookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  initialItemIds?: string[]; // If creating from Heap with pinned items
}

export const CreateNotebookModal: React.FC<CreateNotebookModalProps> = ({ isOpen, onClose, onCreated, initialItemIds = [] }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const notebook = await createNotebook(title, description);
      
      if (initialItemIds.length > 0) {
        try {
            await addItemsToNotebook(notebook.id, initialItemIds);
        } catch (itemErr: any) {
            console.error("Failed to add items to notebook:", itemErr);
            // We successfully created the notebook, but failed to add items.
            // Warn the user but close the modal as the primary action succeeded.
            alert(`Notebook created, but failed to add pinned files: ${itemErr.response?.data?.detail || itemErr.message}`);
            onCreated();
            onClose();
            return;
        }
      }

      onCreated();
      onClose();
      setTitle('');
      setDescription('');
    } catch (err: any) {
      console.error("Failed to create notebook:", err);
      const msg = err.response?.data?.detail || err.response?.data?.error?.message || err.message || "Unknown error";
      setError(`Failed to create notebook: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ width: '400px' }}>
        <div className="modal-header">
          <h3>Create New Notebook</h3>
          <button onClick={onClose} className="modal-close">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {error && <div className="error-message" style={{ color: 'red', marginBottom: '1rem' }}>{error}</div>}
          
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Notebook Title"
              className="text-input"
              style={{ width: '100%', padding: '0.5rem' }}
              autoFocus
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this notebook about?"
              className="text-input"
              style={{ width: '100%', padding: '0.5rem', minHeight: '80px' }}
            />
          </div>

          {initialItemIds.length > 0 && (
             <div style={{ marginBottom: '1.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                will contain {initialItemIds.length} pinned item{initialItemIds.length === 1 ? '' : 's'}.
             </div>
          )}

          <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button 
              type="button" 
              onClick={onClose}
              className="btn-secondary"
              style={{ padding: '0.5rem 1rem', background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-primary)' }}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={!title.trim() || isSubmitting}
              className="btn-primary"
              style={{ 
                  padding: '0.5rem 1rem', 
                  background: 'var(--primary)', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '4px', 
                  cursor: 'pointer',
                  opacity: (!title.trim() || isSubmitting) ? 0.6 : 1
              }}
            >
              {isSubmitting ? 'Creating...' : 'Create Notebook'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

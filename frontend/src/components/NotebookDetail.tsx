import React, { useEffect, useState } from 'react';
import { ArrowLeft, Trash2, Plus, LayoutList, Grid, Calendar, Layout, Bot, Check, X } from 'lucide-react';
import { getNotebook, removeItemFromNotebook, deleteNotebook, updateNotebook } from '../api';
import { Notebook, ContentItem, NotebookViewMode } from '../api/types';
import { FileCard } from './FileCard';
import './Notebooks.css'; // Shared styles
import { AddFilesModal } from './AddFilesModal';
import { EditableField } from './common/EditableField';
import { NotebookFeed } from './NotebookFeed';
import { NotebookCalendar } from './NotebookCalendar';
import { NotebookProject } from './NotebookProject';
import { NotebookAutomationModal } from './NotebookAutomationModal';

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
  const [viewMode, setViewMode] = useState<NotebookViewMode>('GRID');
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAutomationOpen, setIsAutomationOpen] = useState(false);
  
  const fetchNotebook = async () => {
    setLoading(true);
    try {
        const data = await getNotebook(notebookId);
        setNotebook(data);
        setTitle(data.title);
        setDescription(data.description || '');
        if (data.view_mode) {
            setViewMode(data.view_mode);
        }
    } catch (error) {
        console.error("Failed to fetch notebook:", error);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotebook();
  }, [notebookId]);

  const handleSaveTitle = async (newTitle: string) => {
      if (!notebook) return;
      try {
          const updated = await updateNotebook(notebookId, newTitle, description, notebook.view_mode);
          setNotebook(prev => {
              if (!prev) return updated;
              return { ...updated, title: updated.title };
          });
          setTitle(updated.title);
      } catch (error) {
          console.error("Failed to update title:", error);
          fetchNotebook();
      }
  };

  const handleSaveDescription = async (newDesc: string) => {
      if (!notebook) return;
      try {
           const updated = await updateNotebook(notebookId, title, newDesc, notebook.view_mode);
           setNotebook(prev => {
               if (!prev) return updated;
               return { ...updated, description: updated.description };
           });
           setDescription(updated.description || '');
      } catch (error) {
          console.error("Failed to update description:", error);
          fetchNotebook();
      }
  };

  const handleViewModeChange = async (mode: NotebookViewMode) => {
      setViewMode(mode);
      if (notebook) {
          try {
             const updated = await updateNotebook(notebookId, title, description, mode);
             setNotebook(prev => {
                if (!prev) return updated;
                return { ...updated, view_mode: mode };
             });
          } catch (error) {
              console.error("Failed to update view mode:", error);
          }
      }
  }

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
                <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
                     <EditableField 
                        value={title}
                        onSave={handleSaveTitle}
                        className="notebook-title"
                        style={{ color: 'var(--text-primary)' }}
                     />
                </div>
                
                {/* View Mode Selector */}
                <div className="view-mode-selector" style={{ display: 'flex', gap: '4px', background: 'var(--bg-subtle)', padding: '4px', borderRadius: '6px' }}>
                    <button 
                        onClick={() => handleViewModeChange('GRID')}
                        className={`view-mode-btn ${viewMode === 'GRID' ? 'active' : ''}`}
                        title="Grid View"
                        style={{ padding: '4px', borderRadius: '4px', border: 'none', background: viewMode === 'GRID' ? 'var(--bg-paper)' : 'transparent', cursor: 'pointer', display: 'flex' }}
                    >
                        <Grid size={16} color={viewMode === 'GRID' ? 'var(--primary)' : 'var(--text-subtle)'} />
                    </button>
                    <button 
                         onClick={() => handleViewModeChange('FEED')}
                         className={`view-mode-btn ${viewMode === 'FEED' ? 'active' : ''}`}
                         title="Notebook View"
                         style={{ padding: '4px', borderRadius: '4px', border: 'none', background: viewMode === 'FEED' ? 'var(--bg-paper)' : 'transparent', cursor: 'pointer', display: 'flex' }}
                    >
                        <LayoutList size={16} color={viewMode === 'FEED' ? 'var(--primary)' : 'var(--text-subtle)'} />
                    </button>
                    <button 
                         onClick={() => handleViewModeChange('CALENDAR')}
                         className={`view-mode-btn ${viewMode === 'CALENDAR' ? 'active' : ''}`}
                         title="Calendar View"
                         style={{ padding: '4px', borderRadius: '4px', border: 'none', background: viewMode === 'CALENDAR' ? 'var(--bg-paper)' : 'transparent', cursor: 'pointer', display: 'flex' }}
                    >
                        <Calendar size={16} color={viewMode === 'CALENDAR' ? 'var(--primary)' : 'var(--text-subtle)'} />
                    </button>
                    <button 
                         onClick={() => handleViewModeChange('PROJECT')}
                         className={`view-mode-btn ${viewMode === 'PROJECT' ? 'active' : ''}`}
                         title="Project View"
                         style={{ padding: '4px', borderRadius: '4px', border: 'none', background: viewMode === 'PROJECT' ? 'var(--bg-paper)' : 'transparent', cursor: 'pointer', display: 'flex' }}
                    >
                        <Layout size={16} color={viewMode === 'PROJECT' ? 'var(--primary)' : 'var(--text-subtle)'} />
                    </button>
                </div>

                <div style={{ flex: 1 }}></div>

                <button 
                    onClick={() => setIsAddModalOpen(true)}
                    className="action-button-primary"
                    style={{ fontSize: '0.8rem', padding: '0.3rem 0.8rem', flexShrink: 0 }}
                >
                    <Plus size={14} /> Add Files
                </button>
            </div>
             <button onClick={() => setIsAutomationOpen(true)} className="action-button-secondary" title="Automation" style={{ background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: '4px', padding: '0.3rem', cursor: 'pointer', color: 'var(--text-subtle)' }}>
                <Bot size={16} />
            </button>
             <button onClick={handleDeleteNotebook} className="delete-notebook-btn" title="Delete Notebook">
                <Trash2 size={16} />
            </button>
        </div>
        
        <div className="notebook-description-container" style={{ margin: '0 0 1rem 0' }}>
            <div style={{ position: 'relative', maxWidth: '800px' }}>
                <EditableField 
                    value={description}
                    onSave={handleSaveDescription}
                    multiline={true}
                    placeholder="Add a description..."
                    className="notebook-description"
                    style={{ color: 'var(--text-secondary)' }}
                />
            </div>
        </div>

        <div className="notebook-meta">
            Created: {new Date(notebook.created_at).toLocaleDateString()} · {notebook.items?.length || 0} items
        </div>
      </div>

      <div className="notebook-content">
        {viewMode === 'GRID' && (
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
                        isPinned={false}
                        // onTogglePin explicitly undefined to hide pin icon
                        onTogglePin={undefined}
                    />
                    ))
                ) : (
                    <div className="empty-notebook">
                    <p>This notebook is empty.</p>
                    <p>Click "Add Files" to search and add content to this notebook.</p>
                    </div>
                )}
             </div>
        )}

        {viewMode === 'FEED' && notebook.items && (
            <NotebookFeed 
                items={notebook.items} 
                onRemoveItem={handleRemoveItem}
                onRefresh={fetchNotebook}
                selectedItemId={selectedItemId}
                onSelect={(id) => setSelectedItemId(id)}
                onDeselect={() => setSelectedItemId(null)}
            />
        )}
        
        {viewMode === 'CALENDAR' && notebook.items && (
            <NotebookCalendar items={notebook.items} />
        )}
        
        {viewMode === 'PROJECT' && notebook.items && (
            <NotebookProject items={notebook.items} />
        )}
      </div>
      
      {/* Detail View for Selected Item (Only for Grid/Calendar/Project if they support it, Feed probably doesn't need overlay) */}
      {selectedItemId && viewMode !== 'FEED' && (
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
                                  isPinned={false}
                                  onTogglePin={undefined}
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

      <NotebookAutomationModal
        isOpen={isAutomationOpen}
        onClose={() => setIsAutomationOpen(false)}
        notebookId={notebook.id}
      />
    </div>
  );
};

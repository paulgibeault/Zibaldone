import React, { useEffect, useState } from 'react';
import { ArrowLeft, Trash2, Plus, LayoutList, Grid, Calendar, Layout, Bot, Check, X, ArrowDownAZ, ArrowUpAZ, Search } from 'lucide-react';
import { getNotebook, removeItemFromNotebook, deleteNotebook, updateNotebook } from '../api';
import { Notebook, ContentItem, NotebookViewMode } from '../api/types';
import { FileCard } from './FileCard';
import { ExpandedFileView } from './FileCard/ExpandedFileView';
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
  
  const [filterText, setFilterText] = useState('');
  const [sortMode, setSortMode] = useState<'alphabetical' | 'date'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAutomationOpen, setIsAutomationOpen] = useState(false);

  // Sorting and Filtering Logic
  const filteredAndSortedItems = React.useMemo(() => {
      if (!notebook?.items) return [];

      let items = [...notebook.items];

      // Filtering
      if (filterText.trim()) {
          const lowerFilter = filterText.toLowerCase();
          items = items.filter(item => {
              const meta = JSON.parse(item.metadata_json || '{}');
              const title = meta.title || item.original_filename || '';
              const content = meta.summary || ''; // Basic search on summary + title
              return title.toLowerCase().includes(lowerFilter) || content.toLowerCase().includes(lowerFilter);
          });
      }

      // Sorting
      return items.sort((a, b) => {
          let comparison = 0;
          if (sortMode === 'alphabetical') {
                const getTitle = (item: ContentItem) => {
                    try {
                        const meta = JSON.parse(item.metadata_json || '{}');
                        return meta.title || item.original_filename;
                    } catch {
                        return item.original_filename;
                    }
                };
                const nameA = getTitle(a);
                const nameB = getTitle(b);
                comparison = nameA.localeCompare(nameB);
          } else if (sortMode === 'date') {
              const dateA = new Date(a.created_at).getTime();
              const dateB = new Date(b.created_at).getTime();
              comparison = dateA - dateB;
          }
          return sortDirection === 'asc' ? comparison : -comparison;
      });
  }, [notebook?.items, filterText, sortMode, sortDirection]);

  const handleSortChange = (mode: 'alphabetical' | 'date') => {
        if (sortMode === mode) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortMode(mode);
            setSortDirection('desc');
            if (mode === 'alphabetical') {
                setSortDirection('asc'); 
            }
        }
  };
  
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
      // Optimistic update
      setViewMode(mode);
      if (notebook) {
          try {
             // Pass undefined for title/description to avoid overwriting with stale state
             // The API client or backend should handle partial updates or we may need to check the API client implementation
             const updated = await updateNotebook(notebookId, undefined, undefined, mode);
             setNotebook(prev => {
                if (!prev) return updated;
                return { ...updated, view_mode: mode };
             });
          } catch (error) {
              console.error("Failed to update view mode:", error);
              // Revert on failure
              setViewMode(notebook.view_mode); 
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
    <div className={`notebook-detail-container ${viewMode === 'PROJECT' ? 'project-mode' : ''}`}>
      {viewMode === 'PROJECT' ? (
          <div className="notebook-header compact">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <button onClick={onBack} className="btn btn-ghost btn-sm btn-icon" style={{ margin: 0 }}>
                          <ArrowLeft size={18} />
                      </button>
                      <span style={{ fontWeight: 600, fontSize: '1rem' }}>{title}</span>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {/* Compact Toolbar */}
                      <div className="flex-center gap-2">
                          <div className="join">
                              <button 
                                  onClick={() => handleViewModeChange('GRID')}
                                  className={`btn btn-sm btn-ghost ${viewMode === 'GRID' ? 'active text-primary' : ''}`}
                                  title="Grid View"
                              >
                                  <Grid size={16} />
                              </button>
                              <button 
                                  onClick={() => handleViewModeChange('FEED')}
                                  className={`btn btn-sm btn-ghost ${viewMode === 'FEED' ? 'active text-primary' : ''}`}
                                  title="Notebook View"
                              >
                                  <LayoutList size={16} />
                              </button>
                              <button 
                                  onClick={() => handleViewModeChange('CALENDAR')}
                                  className={`btn btn-sm btn-ghost ${viewMode === 'CALENDAR' ? 'active text-primary' : ''}`}
                                  title="Calendar View"
                              >
                                  <Calendar size={16} />
                              </button>
                              <button 
                                  onClick={() => handleViewModeChange('PROJECT')}
                                  className={`btn btn-sm btn-ghost ${viewMode === 'PROJECT' ? 'active text-primary' : ''}`}
                                  title="Project View"
                              >
                                   <Layout size={16} />
                              </button>
                          </div>
                      
                          <button onClick={() => setIsAddModalOpen(true)} className="btn btn-primary btn-sm gap-2">
                              <Plus size={14} /> Add
                          </button>
                          <button onClick={() => setIsAutomationOpen(true)} className="btn btn-ghost btn-sm btn-icon" title="Automation">
                              <Bot size={16} />
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      ) : (
      <div className="notebook-header">
        <button onClick={onBack} className="btn btn-ghost gap-2 mb-4 pl-0">
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


                <div style={{ flex: 1 }}></div>

                <div className="input-with-icon" style={{ marginRight: '1rem' }}>
                    <Search size={16} className="input-icon" />
                    <input
                        type="text"
                        placeholder="Search notebook..."
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                        className="input input-sm"
                        style={{ width: '200px', paddingLeft: '2.5rem' }}
                    />
                    {filterText && (
                        <button 
                            className="input-clear-btn"
                            onClick={() => setFilterText('')}
                            title="Clear search"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>

                <button 
                    onClick={() => setIsAddModalOpen(true)}
                    className="btn btn-primary btn-sm gap-2"
                >
                    <Plus size={14} /> Add Files
                </button>
            </div>
             <button onClick={() => setIsAutomationOpen(true)} className="btn btn-ghost btn-sm btn-icon" title="Automation">
                <Bot size={16} />
            </button>
             <button onClick={handleDeleteNotebook} className="btn btn-ghost btn-sm btn-icon text-danger" title="Delete Notebook">
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

        <div className="notebook-meta" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Created: {new Date(notebook.created_at).toLocaleDateString()} · {filteredAndSortedItems.length} items</span>
            
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div className="sort-btn-group" style={{ display: 'flex' }}>
                        <button
                        className={`sort-btn ${sortMode === 'alphabetical' ? 'active' : ''}`}
                        onClick={() => handleSortChange('alphabetical')}
                        title="Sort A-Z"
                    >
                        {sortMode === 'alphabetical' && sortDirection === 'desc' ? <ArrowUpAZ size={18} /> : <ArrowDownAZ size={18} />}
                    </button>
                    <button
                        className={`sort-btn ${sortMode === 'date' ? 'active' : ''}`}
                        onClick={() => handleSortChange('date')}
                        title="Sort by Date"
                    >
                        <Calendar size={18} />
                    </button>
                </div>
            
                {/* View Mode Selector */}
                <div className="join">
                    <button 
                        onClick={() => handleViewModeChange('GRID')}
                        className={`btn btn-sm btn-ghost ${viewMode === 'GRID' ? 'active text-primary' : ''}`}
                        title="Grid View"
                    >
                        <Grid size={18} />
                    </button>
                    <button 
                        onClick={() => handleViewModeChange('FEED')}
                        className={`btn btn-sm btn-ghost ${viewMode === 'FEED' ? 'active text-primary' : ''}`}
                        title="Notebook View"
                    >
                        <LayoutList size={18} />
                    </button>
                    <button 
                        onClick={() => handleViewModeChange('CALENDAR')}
                        className={`btn btn-sm btn-ghost ${viewMode === 'CALENDAR' ? 'active text-primary' : ''}`}
                        title="Calendar View"
                    >
                        <Calendar size={18} />
                    </button>
                    <button 
                        onClick={() => handleViewModeChange('PROJECT')}
                        className={`btn btn-sm btn-ghost ${viewMode === 'PROJECT' ? 'active text-primary' : ''}`}
                        title="Project View"
                    >
                         <Layout size={18} />
                    </button>
                </div>
            </div>
        </div>
      </div>
      )}

      <div className={`notebook-content ${viewMode === 'PROJECT' ? 'full-height' : ''}`}>
        {viewMode === 'GRID' && (
             selectedItemId ? (
                 (() => {
                    const item = notebook.items?.find(i => i.id === selectedItemId);
                    if (!item) return null;
                    return (
                        <ExpandedFileView
                            item={item}
                            onBack={() => setSelectedItemId(null)}
                            onDelete={(id, e) => handleRemoveItem(id, e)}
                            onRefresh={fetchNotebook}
                            isPinned={false}
                            onTogglePin={undefined}
                        />
                    );
                 })()
             ) : (
                 <div className="files-grid-fixed">
                    {filteredAndSortedItems && filteredAndSortedItems.length > 0 ? (
                        filteredAndSortedItems.map((item: ContentItem) => (
                        <FileCard
                            key={item.id}
                            item={item}
                            onDelete={(id, e) => handleRemoveItem(id, e)}
                            onRefresh={fetchNotebook}
                            isSelected={false}
                            onSelect={() => setSelectedItemId(item.id)}
                            onDeselect={() => setSelectedItemId(null)}
                            isPinned={false}
                            // onTogglePin explicitly undefined to hide pin icon
                            onTogglePin={undefined}
                        />
                        ))
                    ) : (
                        <div className="empty-notebook">
                        <p>This notebook is empty or no items match your search.</p>
                        <p>Click "Add Files" to search and add content to this notebook.</p>
                        </div>
                    )}
                 </div>
             )
        )}

        {viewMode === 'FEED' && filteredAndSortedItems && (
            <NotebookFeed 
                items={filteredAndSortedItems} 
                onRemoveItem={handleRemoveItem}
                onRefresh={fetchNotebook}
                selectedItemId={selectedItemId}
                onSelect={(id) => setSelectedItemId(id)}
                onDeselect={() => setSelectedItemId(null)}
            />
        )}
        
        {viewMode === 'CALENDAR' && filteredAndSortedItems && (
            <NotebookCalendar items={filteredAndSortedItems} />
        )}
        
        {viewMode === 'PROJECT' && filteredAndSortedItems && (
            <NotebookProject items={filteredAndSortedItems} notebookId={notebookId} />
        )}
      </div>
      
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

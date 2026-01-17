import React, { useEffect, useState } from 'react';
import { Plus, Book, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getNotebooks, deleteNotebook } from '../api';
import { Notebook } from '../api/types';
import { CreateNotebookModal } from './CreateNotebookModal';
import { NotebookDetail } from './NotebookDetail';
import { ViewContainer } from './ViewContainer';
import { ViewHeader } from './ViewHeader';
import './Notebooks.css';
import { useLocation } from 'react-router-dom';

interface NotebooksProps {
    isActive: boolean;
    pinnedItems?: Set<string>;
}

export const Notebooks: React.FC<NotebooksProps> = ({ isActive, pinnedItems = new Set() }) => {
    const [notebooks, setNotebooks] = useState<Notebook[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedNotebookId, setSelectedNotebookId] = useState<string | null>(null);

    // Initial item IDs passed from other tabs (e.g. Heap) via state
    const location = useLocation();
    const [initialPinnedItems, setInitialPinnedItems] = useState<string[]>([]);
    
    const navigate = useNavigate();
    
    useEffect(() => {
        // If we navigated here with state to create a notebook
        if (isActive && location.state && (location.state as any).createNotebook) {
            const state = location.state as any;
            if (state.pinnedItemIds) {
                setInitialPinnedItems(state.pinnedItemIds);
            }
            setIsCreateModalOpen(true);
            
            // Clear state so we don't reopen on future renders or tab switches
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [isActive, location, navigate]);

    const fetchNotebooks = async () => {
        setLoading(true);
        try {
            const data = await getNotebooks();
            setNotebooks(data);
        } catch (error) {
            console.error("Failed to fetch notebooks:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isActive && !selectedNotebookId) {
            fetchNotebooks();
        }
    }, [isActive, selectedNotebookId]);

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!window.confirm("Are you sure you want to delete this notebook?")) {
            return;
        }
        try {
            await deleteNotebook(id);
            fetchNotebooks();
        } catch (error) {
            console.error("Failed to delete notebook:", error);
            alert("Failed to delete notebook");
        }
    };

    if (selectedNotebookId) {
        return (
            <ViewContainer>
                <NotebookDetail 
                    notebookId={selectedNotebookId} 
                    onBack={() => setSelectedNotebookId(null)} 
                />
            </ViewContainer>
        );
    }

    return (
        <ViewContainer>
            <ViewHeader
                title="Notebooks"
                subtitle="Curated collections of your content."
                controls={
                     <button
                        onClick={() => {
                            // If there are pinned items from the parent (Heap), use them.
                            // Convert Set to Array
                            if (pinnedItems && pinnedItems.size > 0) {
                                setInitialPinnedItems(Array.from(pinnedItems));
                            }
                            setIsCreateModalOpen(true);
                        }}
                        className="action-button-primary"
                    >
                        <Plus size={16} />
                        New Notebook
                    </button>
                }
            />

            <div className="notebooks-content" style={{ padding: '1.5rem' }}>
                {loading ? (
                    <div>Loading notebooks...</div>
                ) : (
                    <div className="notebooks-grid">
                        {notebooks.length === 0 ? (
                            <div className="empty-state">
                                <p>No notebooks yet.</p>
                                <button onClick={() => setIsCreateModalOpen(true)}>Create one</button>
                            </div>
                        ) : (
                            notebooks.map(notebook => (
                                <div 
                                    key={notebook.id} 
                                    className="notebook-card"
                                    onClick={() => setSelectedNotebookId(notebook.id)}
                                    style={{ position: 'relative' }}
                                >
                                    <button 
                                        className="notebook-delete-icon"
                                        onClick={(e) => handleDelete(e, notebook.id)}
                                        style={{
                                            position: 'absolute',
                                            top: '1rem',
                                            right: '1rem',
                                            background: 'none',
                                            border: 'none',
                                            color: 'var(--text-subtle)',
                                            cursor: 'pointer',
                                            padding: '4px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            borderRadius: '4px',
                                            zIndex: 10
                                        }}
                                        title="Delete Notebook"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                    <div className="notebook-card-icon">
                                        <Book size={32} />
                                    </div>
                                    <div className="notebook-card-info">
                                        <h3>{notebook.title}</h3>
                                        <p>{notebook.description || "No description"}</p>
                                        <span className="notebook-date">
                                            Updated {new Date(notebook.updated_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            <CreateNotebookModal
                isOpen={isCreateModalOpen}
                onClose={() => {
                    setIsCreateModalOpen(false);
                    setInitialPinnedItems([]); // Reset
                }}
                onCreated={fetchNotebooks}
                initialItemIds={initialPinnedItems}
            />
        </ViewContainer>
    );
};

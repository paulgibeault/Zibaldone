import React from 'react';
import { FileCard } from './FileCard';
import { type ContentItem } from '../api';
import { ViewHeader } from './ViewHeader';
import { ViewContainer } from './ViewContainer';

import { RefreshCw } from 'lucide-react';
import { restartAllFailedTasks } from '../api/endpoints/tasks';

interface HeapProps {
    items: ContentItem[];
    onDelete: (id: string, e: React.MouseEvent) => Promise<void>;
    onRefresh: () => void;
    selectedItemId: string | null;
    onSelect: (id: string) => void;
    onDeselect: () => void;
}

export const Heap = ({ items, onDelete, onRefresh, selectedItemId, onSelect, onDeselect }: HeapProps) => {
    const failedTasksCount = items.reduce((acc, item) => acc + (item.tasks?.filter(t => t.status === 'FAILED').length || 0), 0);
    
    const handleRestartFailed = async () => {
        try {
            await restartAllFailedTasks();
            onRefresh();
        } catch (error) {
            console.error("Failed to restart tasks:", error);
        }
    };

    return (
        <ViewContainer>
            <ViewHeader
                title="The Heap"
                subtitle="Your unstructured pile of everything."
                controls={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        {failedTasksCount > 0 && (
                            <button 
                                onClick={handleRestartFailed}
                                className="action-button"
                                style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '0.5rem',
                                    padding: '0.4rem 0.8rem',
                                    fontSize: '0.85rem',
                                    background: 'var(--surface-hover)',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: '0.5rem',
                                    cursor: 'pointer',
                                    color: 'var(--text-main)'
                                }}
                            >
                                <RefreshCw size={14} />
                                Restart Failed ({failedTasksCount})
                            </button>
                        )}
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                            {items.length} items
                        </span>
                    </div>
                }
            />

            <div className="item-list">
                {items.map((item: ContentItem) => (
                    <FileCard
                        key={item.id}
                        item={item}
                        onDelete={onDelete}
                        onRefresh={onRefresh}
                        isSelected={selectedItemId === item.id}
                        onSelect={() => onSelect(item.id)}
                        onDeselect={onDeselect}
                    />
                ))}
                {items.length === 0 && (
                    <div style={{
                        gridColumn: '1 / -1',
                        textAlign: 'center',
                        padding: '4rem',
                        color: 'var(--text-muted)',
                        border: '2px dashed var(--border-subtle)',
                        borderRadius: '1rem'
                    }}>
                        <p>The Heap is empty.</p>
                        <p style={{ fontSize: '0.9rem' }}>Drag and drop files above to add them.</p>
                    </div>
                )}
            </div>
        </ViewContainer>
    );
};

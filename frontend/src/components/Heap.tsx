import React from 'react';
import { FileCard } from './FileCard';
import { type ContentItem } from '../api';
import { ViewHeader } from './ViewHeader';
import { ViewContainer } from './ViewContainer';

interface HeapProps {
    items: ContentItem[];
    onDelete: (id: string, e: React.MouseEvent) => Promise<void>;
    onRefresh: () => void;
    selectedItemId: string | null;
    onSelect: (id: string) => void;
    onDeselect: () => void;
}

export const Heap = ({ items, onDelete, onRefresh, selectedItemId, onSelect, onDeselect }: HeapProps) => {
    return (
        <ViewContainer>
            <ViewHeader
                title="The Heap"
                subtitle="Your unstructured pile of everything."
                controls={
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        {items.length} items
                    </span>
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

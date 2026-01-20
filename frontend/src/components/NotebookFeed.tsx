import React from 'react';
import { ContentItem } from '../api/types';
import { FileCard } from './FileCard';

interface NotebookFeedProps {
  items: ContentItem[];
  onRemoveItem: (id: string, e: React.MouseEvent) => void;
  onRefresh: () => void;
  selectedItemId: string | null;
  onSelect: (id: string) => void;
  onDeselect: () => void;
}

export const NotebookFeed: React.FC<NotebookFeedProps> = ({
  items,
  onRemoveItem,
  onRefresh,
  selectedItemId,
  onSelect,
  onDeselect
}) => {
  return (
    <div className="notebook-feed" style={{ width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {items.map((item) => (
        <FileCard
          key={item.id}
          item={item}
          onDelete={onRemoveItem}
          onRefresh={onRefresh}
          isSelected={selectedItemId === item.id}
          onSelect={() => onSelect(item.id)}
          onDeselect={onDeselect}
          isPinned={false}
          onTogglePin={undefined}
          forceExpanded={true}
          defaultTab="preview"
        />
      ))}
    </div>
  );
};

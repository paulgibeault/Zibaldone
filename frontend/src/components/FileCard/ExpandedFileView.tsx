import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { FileCard } from './index';
import { type ContentItem } from '../../api';

interface ExpandedFileViewProps {
    item: ContentItem;
    onBack: () => void;
    onDelete: (id: string, e: React.MouseEvent) => void;
    onRefresh: () => void;
    isPinned?: boolean;
    onTogglePin?: (id: string, e?: React.MouseEvent) => void;
}

export const ExpandedFileView: React.FC<ExpandedFileViewProps> = ({
    item,
    onBack,
    onDelete,
    onRefresh,
    isPinned,
    onTogglePin
}) => {
    return (
        <div className="expanded-file-view">
            <div style={{ marginBottom: '1rem' }}>
                <button 
                    onClick={onBack}
                    style={{ 
                        background: 'none', 
                        border: 'none', 
                        color: 'var(--text-muted)', 
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.25rem'
                    }}
                >
                    <ArrowLeft size={16} /> Back to list
                </button>
            </div>
            <FileCard
                item={item}
                onDelete={onDelete}
                onRefresh={onRefresh}
                isSelected={true}
                onSelect={() => {}} 
                onDeselect={onBack}
                isPinned={isPinned}
                onTogglePin={onTogglePin}
            />
        </div>
    );
};

import React from 'react';
import { Trash2 } from 'lucide-react';
import { type Tag as TagType } from '../../api';
import TagPicker from '../TagPicker';

interface FileCardFooterProps {
    itemId: string;
    currentItemTags: TagType[];
    onRefresh: () => void;
    onDelete: (id: string, e: React.MouseEvent) => void;
}

export const FileCardFooter: React.FC<FileCardFooterProps> = ({ itemId, currentItemTags, onRefresh, onDelete }) => {
    return (
        <div className="card-footer-v2">
            <div className="inline-tag-picker-compact">
                <TagPicker itemId={itemId} currentItemTags={currentItemTags} onRefresh={onRefresh} />
            </div>
            <button
                type="button"
                className="btn btn-ghost btn-icon btn-danger delete-btn-footer"
                onClick={(e) => onDelete(itemId, e)}
                title="Delete file"
            >
                <Trash2 size={18} />
            </button>
        </div>
    );
};

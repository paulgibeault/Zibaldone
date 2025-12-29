import React, { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { type Tag, getTags, addTagToItem, removeTagFromItem } from '../api';

interface TagPickerProps {
    itemId: string;
    currentItemTags: Tag[];
    onRefresh: () => void;
}

const TagPicker: React.FC<TagPickerProps> = ({ itemId, currentItemTags, onRefresh }) => {
    const [allTags, setAllTags] = useState<Tag[]>([]);
    const [showPicker, setShowPicker] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (showPicker) {
            fetchAllTags();
        }
    }, [showPicker]);

    const fetchAllTags = async (): Promise<void> => {
        try {
            const data = await getTags();
            setAllTags(data);
        } catch (error) {
            console.error('Error fetching all tags:', error);
        }
    };

    const isTagApplied = (tagId: string): boolean => {
        return currentItemTags.some((t: Tag) => t.id === tagId);
    };

    const handleToggleTag = async (tagId: string): Promise<void> => {
        try {
            if (isTagApplied(tagId)) {
                await removeTagFromItem(itemId, tagId);
            } else {
                await addTagToItem(itemId, tagId);
            }
            onRefresh();
        } catch (error) {
            console.error('Error toggling tag:', error);
        }
    };

    const filteredTags = allTags.filter((tag: Tag) =>
        tag.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="tag-picker-container">
            <div className="current-tags">
                {(currentItemTags || []).map((tag: Tag) => (
                    <span
                        key={tag.id}
                        className="tag-badge"
                        style={{ backgroundColor: tag.color }}
                        onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            handleToggleTag(tag.id);
                        }}
                        title="Click to remove"
                    >
                        {tag.name} <X size={10} style={{ marginLeft: '4px' }} />
                    </span>
                ))}
                <button
                    className="add-tag-btn-minimal"
                    onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        setShowPicker(!showPicker);
                    }}
                    title="Add Tag"
                >
                    <Plus size={14} />
                </button>
            </div>

            {showPicker && (
                <>
                    <div className="modal-backdrop" onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        setShowPicker(false);
                    }}></div>
                    <div className="tag-picker-modal glass-panel" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        <div className="picker-header">
                            <h3>Apply Tags</h3>
                            <button onClick={() => setShowPicker(false)} className="close-all-btn"><X size={18} /></button>
                        </div>
                        <input
                            type="text"
                            placeholder="Find or filter tags..."
                            value={searchTerm}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                            className="tag-search-input"
                            autoFocus
                        />
                        <div className="picker-list">
                            {filteredTags.map((tag: Tag) => (
                                <div
                                    key={tag.id}
                                    className={`picker-item-compact ${isTagApplied(tag.id) ? 'selected' : ''}`}
                                    onClick={() => handleToggleTag(tag.id)}
                                >
                                    <span className="picker-tag-dot" style={{ backgroundColor: tag.color }} />
                                    <span className="picker-tag-name">{tag.name}</span>
                                    {isTagApplied(tag.id) && <X size={12} className="remove-indicator" />}
                                </div>
                            ))}
                            {filteredTags.length === 0 && (
                                <p className="empty-msg">No tags found.</p>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default TagPicker;

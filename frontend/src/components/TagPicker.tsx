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
    const [isAdding, setIsAdding] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (isAdding) {
            fetchAllTags();
        }
    }, [isAdding]);

    const fetchAllTags = async (): Promise<void> => {
        try {
            const data = await getTags();
            setAllTags(data);
        } catch (error) {
            console.error('Error fetching all tags:', error);
        }
    };

    const isTagApplied = (tagId: string): boolean => {
        return (currentItemTags || []).some((t: Tag) => t.id === tagId);
    };

    const handleToggleTag = async (tagId: string, e: React.MouseEvent): Promise<void> => {
        e.preventDefault();
        e.stopPropagation();
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

    // Tags that are NOT currently applied
    const unappliedTags = filteredTags.filter(tag => !isTagApplied(tag.id));

    return (
        <div className="inline-tag-picker">
            <div className="current-tags-row">
                {(currentItemTags || []).map((tag: Tag) => (
                    <span
                        key={tag.id}
                        className="standard-tag"
                        style={{ borderLeft: `3px solid ${tag.color}` }}
                    >
                        {tag.name}
                        <button
                            type="button"
                            className="remove-tag-mini"
                            onClick={(e: React.MouseEvent) => handleToggleTag(tag.id, e)}
                            title="Remove tag"
                        >
                            <X size={10} />
                        </button>
                    </span>
                ))}

                <button
                    type="button"
                    className={`toggle-add-tag-btn ${isAdding ? 'active' : ''}`}
                    onClick={(e: React.MouseEvent) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsAdding(!isAdding);
                    }}
                    title={isAdding ? "Close picker" : "Add tag"}
                >
                    {isAdding ? <X size={14} /> : <Plus size={14} />}
                </button>
            </div>

            {isAdding && (
                <div className="inline-picker-panel fade-in" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                    <div className="picker-search-container">
                        <input
                            type="text"
                            placeholder="Filter tags..."
                            value={searchTerm}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                            onKeyDown={(e: React.KeyboardEvent) => e.stopPropagation()}
                            autoFocus
                        />
                    </div>
                    <div className="available-tags-grid">
                        {unappliedTags.length > 0 ? (
                            unappliedTags.map((tag: Tag) => (
                                <button
                                    key={tag.id}
                                    type="button"
                                    className="available-tag-item"
                                    onClick={(e: React.MouseEvent) => handleToggleTag(tag.id, e)}
                                    style={{ borderColor: tag.color }}
                                >
                                    <span className="tag-dot" style={{ backgroundColor: tag.color }} />
                                    {tag.name}
                                </button>
                            ))
                        ) : (
                            <div className="no-tags-found">
                                {searchTerm ? "No tags match" : "All tags applied"}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TagPicker;

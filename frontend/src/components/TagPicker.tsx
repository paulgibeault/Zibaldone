import React, { useState, useEffect } from 'react';
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

    const fetchAllTags = async () => {
        try {
            const data = await getTags();
            setAllTags(data);
        } catch (error) {
            console.error('Error fetching all tags:', error);
        }
    };

    const isTagApplied = (tagId: string) => {
        return currentItemTags.some((t: Tag) => t.id === tagId);
    };

    const handleToggleTag = async (tagId: string) => {
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
                        onClick={() => handleToggleTag(tag.id)}
                        title="Click to remove"
                    >
                        {tag.name} ×
                    </span>
                ))}
                <button
                    className="btn btn-sm btn-outline-secondary add-tag-btn"
                    onClick={() => setShowPicker(!showPicker)}
                >
                    + Tag
                </button>
            </div>

            {showPicker && (
                <>
                    <div className="modal-backdrop" onClick={() => setShowPicker(false)}></div>
                    <div className="tag-picker-modal">
                        <div className="picker-header">
                            <h3>Select Tags</h3>
                            <button onClick={() => setShowPicker(false)} className="close-all-btn">&times;</button>
                        </div>
                        <input
                            type="text"
                            placeholder="Search tags..."
                            value={searchTerm}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                            className="tag-search-input"
                            autoFocus
                        />
                        <div className="picker-list">
                            {filteredTags.map((tag: Tag) => (
                                <label key={tag.id} className="picker-item">
                                    <input
                                        type="checkbox"
                                        checked={isTagApplied(tag.id)}
                                        onChange={() => handleToggleTag(tag.id)}
                                    />
                                    <span className="picker-tag-preview" style={{ backgroundColor: tag.color }}>
                                        {tag.name}
                                    </span>
                                </label>
                            ))}
                            {filteredTags.length === 0 && (
                                <p className="empty-msg">No matching tags found.</p>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default TagPicker;

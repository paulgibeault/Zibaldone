import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X } from 'lucide-react';
import { type Tag, getTags, addTagToItem, removeTagFromItem } from '../api';

interface TagPickerProps {
    itemId: string;
    currentItemTags: Tag[];
    onRefresh: () => void;
}

const TagPicker: React.FC<TagPickerProps> = ({ itemId, currentItemTags, onRefresh }) => {
    const [allTags, setAllTags] = useState<Tag[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isTagging, setIsTagging] = useState<string | null>(null);

    // Helper to determine text color based on background brightness and theme
    const getContrastColor = (hexcolor: string) => {
        if (!hexcolor) return 'var(--text-primary)';

        // Get the current theme's tag opacity to see if it's "light mode style" (faded)
        const root = document.documentElement;
        const opacity = parseFloat(getComputedStyle(root).getPropertyValue('--tag-bg-opacity').trim() || '0.9');

        // If opacity is very low, we are likely in light mode with faded tags, use dark text
        if (opacity < 0.4) {
            return 'var(--text-primary)';
        }

        const hex = hexcolor.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

        return luminance > 0.6 ? '#0f172a' : '#ffffff';
    };

    useEffect(() => {
        if (isOpen) {
            fetchAllTags();
        }
    }, [isOpen]);

    const fetchAllTags = async (): Promise<void> => {
        try {
            console.log('[TagPicker] Fetching all tags...');
            const data = await getTags();
            setAllTags(data);
        } catch (error) {
            console.error('[TagPicker] Error fetching all tags:', error);
        }
    };

    const isTagApplied = (tagId: string): boolean => {
        return (currentItemTags || []).some((t: Tag) => t.id === tagId);
    };

    const handleToggleTag = async (tagId: string, e: React.MouseEvent): Promise<void> => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        if (isTagging) return;

        console.log(`[TagPicker] Toggling tag ${tagId} for item ${itemId}`);
        setIsTagging(tagId);

        try {
            const applied = isTagApplied(tagId);
            if (applied) {
                await removeTagFromItem(itemId, tagId);
                console.log(`[TagPicker] Successfully removed tag ${tagId}`);
            } else {
                await addTagToItem(itemId, tagId);
                console.log(`[TagPicker] Successfully added tag ${tagId}`);
            }

            console.log(`[TagPicker] Calling onRefresh() for item ${itemId}`);
            onRefresh();
            setIsOpen(false);
            setSearchTerm('');
        } catch (error: any) {
            console.error('[TagPicker] Error toggling tag:', error);
        } finally {
            setIsTagging(null);
        }
    };

    const filteredTags = allTags.filter((tag: Tag) =>
        tag.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const unappliedTags = filteredTags.filter(tag => !isTagApplied(tag.id));

    return (
        <div className="tag-picker-container">
            <div className="current-tags-row">
                {(currentItemTags || []).map((tag: Tag) => (
                    <span
                        key={tag.id}
                        className="standard-tag"
                        style={{
                            backgroundColor: `color-mix(in srgb, ${tag.color}, transparent calc(100% - (var(--tag-bg-opacity) * 100%)))`,
                            color: getContrastColor(tag.color)
                        }}
                    >
                        {tag.name}
                        <button
                            type="button"
                            className="remove-tag-mini"
                            onClick={(e: React.MouseEvent) => handleToggleTag(tag.id, e)}
                            style={{ color: getContrastColor(tag.color) }}
                            title="Remove tag"
                        >
                            <X size={12} />
                        </button>
                    </span>
                ))}

                <button
                    type="button"
                    className="toggle-add-tag-btn"
                    onClick={(e: React.MouseEvent) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsOpen(true);
                    }}
                    title="Add tag"
                >
                    <Plus size={14} />
                </button>
            </div>

            {isOpen && createPortal(
                <div className="picker-modal-overlay" onClick={() => setIsOpen(false)}>
                    <div className="picker-modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="picker-modal-header">
                            <h3>Select a Tag</h3>
                            <button type="button" className="close-modal-btn" onClick={() => setIsOpen(false)}>
                                <X size={18} />
                            </button>
                        </div>

                        <div className="picker-search-container">
                            <input
                                type="text"
                                placeholder="Filter tags..."
                                value={searchTerm}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                                autoFocus
                            />
                        </div>

                        <div className="available-tags-grid">
                            {unappliedTags.length > 0 ? (
                                unappliedTags.map((tag: Tag) => (
                                    <button
                                        key={tag.id}
                                        type="button"
                                        className={`available-tag-item ${isTagging === tag.id ? 'loading' : ''}`}
                                        onClick={(e: React.MouseEvent) => handleToggleTag(tag.id, e)}
                                        disabled={!!isTagging}
                                        style={{
                                            backgroundColor: `color-mix(in srgb, ${tag.color}, transparent calc(100% - (var(--tag-bg-opacity) * 100%)))`,
                                            color: getContrastColor(tag.color),
                                            borderColor: 'transparent'
                                        }}
                                    >
                                        {tag.name}
                                        {isTagging === tag.id && <span className="tag-loading-spinner" style={{ borderTopColor: getContrastColor(tag.color) }} />}
                                    </button>
                                ))
                            ) : (
                                <div className="no-tags-found">
                                    {searchTerm ? "No tags match" : "All tags applied"}
                                </div>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default TagPicker;

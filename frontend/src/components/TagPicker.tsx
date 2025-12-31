import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X } from 'lucide-react';
import { approveTag, type Tag as TagType } from '../api';
import { Tag } from './Tag';
import { useTags } from '../hooks/useTags';

interface TagPickerProps {
    itemId: string;
    currentItemTags: TagType[];
    onRefresh: () => void;
}

const TagPicker = ({
    itemId,
    currentItemTags,
    onRefresh
}: TagPickerProps) => {
    const { allTags, isLoading, fetchTags, toggleTagForItem } = useTags();
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isTagging, setIsTagging] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchTags();
        }
    }, [isOpen, fetchTags]);

    const isTagApplied = (tagId: string): boolean => {
        return (currentItemTags || []).some((t: TagType) => t.id === tagId);
    };

    const handleToggleTag = async (tagId: string, e: React.MouseEvent): Promise<void> => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        if (isTagging) return;

        setIsTagging(tagId);
        const success = await toggleTagForItem(itemId, tagId, currentItemTags);

        if (success) {
            onRefresh();
            setIsOpen(false);
            setSearchTerm('');
        }
        setIsTagging(null);
    };

    const handleApproveTag = async (tagId: string, e: React.MouseEvent): Promise<void> => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        try {
            await approveTag(tagId);
            onRefresh();
        } catch (err) {
            console.error("Failed to approve tag", err);
        }
    };

    const filteredTags = allTags.filter((tag: TagType) =>
        tag.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const unappliedTags = filteredTags.filter((tag: TagType) => !isTagApplied(tag.id));

    return (
        <div className="tag-picker-container">
            <div className="current-tags-row">
                {(currentItemTags || []).map((tag: TagType) => (
                    <Tag
                        key={tag.id}
                        tag={tag}
                        onRemove={handleToggleTag}
                        onApprove={handleApproveTag}
                        showRemoveIcon={true}
                        showApproveIcon={true}
                    />
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
                            {!isLoading && unappliedTags.length > 0 ? (
                                unappliedTags.map((tag: TagType) => (
                                    <button
                                        key={tag.id}
                                        type="button"
                                        className={`available-tag-item ${isTagging === tag.id ? 'loading' : ''}`}
                                        onClick={(e: React.MouseEvent) => handleToggleTag(tag.id, e)}
                                        disabled={!!isTagging}
                                    >
                                        <Tag tag={tag} />
                                        {isTagging === tag.id && <span className="tag-loading-spinner" />}
                                    </button>
                                ))
                            ) : (
                                <div className="no-tags-found">
                                    {isLoading ? "Loading..." : (searchTerm ? "No tags match" : "All tags applied")}
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

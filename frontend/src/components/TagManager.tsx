import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Tag as TagIcon } from 'lucide-react';
import { type Tag, getTags, createTag, deleteTag, updateTag, getItems, type ContentItem } from '../api';

const TagManager: React.FC = () => {
    const [tags, setTags] = useState<Tag[]>([]);
    const [tagUsage, setTagUsage] = useState<Record<string, number>>({});
    const [newTagName, setNewTagName] = useState<string>('');
    const [newTagColor, setNewTagColor] = useState<string>('#6366f1');
    const [loading, setLoading] = useState<boolean>(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState<string>('');
    const [editColor, setEditColor] = useState<string>('');

    // Helper to determine text color based on background brightness and theme
    const getContrastColor = (hexcolor: string) => {
        if (!hexcolor) return 'var(--text-primary)';

        // Get the current theme's tag opacity
        const root = document.documentElement;
        const opacity = parseFloat(getComputedStyle(root).getPropertyValue('--tag-bg-opacity').trim() || '0.9');

        // If opacity is low (light mode), use primary text color
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
        fetchData();
    }, []);

    const fetchData = async (): Promise<void> => {
        setLoading(true);
        try {
            const [tagsData, itemsData] = await Promise.all([getTags(), getItems()]);
            setTags(tagsData);

            // Calculate usage count for each tag
            const usage: Record<string, number> = {};
            itemsData.forEach((item: ContentItem) => {
                (item.tags || []).forEach((t: Tag) => {
                    usage[t.id] = (usage[t.id] || 0) + 1;
                });
            });
            setTagUsage(usage);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateTag = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault();
        if (!newTagName.trim()) return;
        try {
            await createTag(newTagName, newTagColor);
            setNewTagName('');
            fetchData();
        } catch (error) {
            console.error('Error creating tag:', error);
        }
    };

    const handleUpdateTag = async (id: string): Promise<void> => {
        try {
            await updateTag(id, { name: editName, color: editColor });
            setEditingId(null);
            fetchData();
        } catch (error) {
            console.error('Error updating tag:', error);
        }
    };

    const handleDeleteTag = async (id: string): Promise<void> => {
        if (!window.confirm('Are you sure you want to delete this tag?')) return;
        try {
            await deleteTag(id);
            fetchData();
        } catch (error) {
            console.error('Error deleting tag:', error);
        }
    };

    const getTagFontSize = (tagId: string): string => {
        const count = tagUsage[tagId] || 0;
        if (count === 0) return '0.85rem';
        const size = 0.85 + Math.min(count * 0.2, 1.5);
        return `${size}rem`;
    };

    return (
        <div className="tag-manager-dashboard fade-in">
            <div className="manager-header">
                <div>
                    <h2>Manage Tags</h2>
                    <p className="subtitle">Curate and organize your digital collection.</p>
                </div>
                <div className="stats-mini">
                    <div className="stat-item">
                        <TagIcon size={16} />
                        <span>{tags.length} Unique Tags</span>
                    </div>
                </div>
            </div>

            <section className="word-cloud-section glass-panel">
                <h3>Word Cloud</h3>
                <div className="word-cloud">
                    {tags.length === 0 ? (
                        <p className="empty-msg">No tags found. Start by creating one below!</p>
                    ) : (
                        tags.map((tag: Tag) => (
                            <span
                                key={tag.id}
                                className="cloud-tag"
                                style={{
                                    backgroundColor: `color-mix(in srgb, ${tag.color}, transparent calc(100% - (var(--tag-bg-opacity) * 100%)))`,
                                    color: getContrastColor(tag.color),
                                    fontSize: getTagFontSize(tag.id),
                                    opacity: tagUsage[tag.id] ? 1 : 0.6,
                                    border: '1px solid var(--tag-border)',
                                    boxShadow: 'var(--tag-shadow)'
                                }}
                                title={`${tagUsage[tag.id] || 0} items tagged`}
                            >
                                {tag.name}
                                {tagUsage[tag.id] > 0 && <span className="usage-count">{tagUsage[tag.id]}</span>}
                            </span>
                        ))
                    )}
                </div>
            </section>

            <div className="tag-management-grid">
                <section className="create-tag-section">
                    <h3>Create New Tag</h3>
                    <form onSubmit={handleCreateTag} className="tag-form-modern">
                        <div className="input-with-icon">
                            <TagIcon size={18} className="input-icon" />
                            <input
                                type="text"
                                placeholder="Tag name..."
                                value={newTagName}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTagName(e.target.value)}
                            />
                        </div>
                        <input
                            type="color"
                            value={newTagColor}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTagColor(e.target.value)}
                            className="color-pill"
                        />
                        <button type="submit" className="btn-circle-add" title="Add Tag">
                            <Plus size={24} />
                        </button>
                    </form>
                </section>

                <section className="existing-tags-section">
                    <h3>All Tags</h3>
                    <div className="tag-grid-scroll">
                        {loading ? (
                            <div className="loading-small">Loading tags...</div>
                        ) : (
                            tags.map((tag: Tag) => (
                                <div key={tag.id} className="tag-management-item">
                                    {editingId === tag.id ? (
                                        <div className="tag-edit-inline">
                                            <input
                                                type="text"
                                                value={editName}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditName(e.target.value)}
                                                autoFocus
                                            />
                                            <input
                                                type="color"
                                                value={editColor}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditColor(e.target.value)}
                                            />
                                            <button
                                                type="button"
                                                onClick={(e) => { e.preventDefault(); handleUpdateTag(tag.id); }}
                                                className="btn-save"
                                            >
                                                Save
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => { e.preventDefault(); setEditingId(null); }}
                                                className="btn-cancel"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="tag-display" style={{
                                                backgroundColor: `color-mix(in srgb, ${tag.color}, transparent calc(100% - (var(--tag-bg-opacity) * 100%)))`,
                                                color: getContrastColor(tag.color),
                                                padding: '4px 14px',
                                                borderRadius: '99px',
                                                fontSize: '0.85rem',
                                                fontWeight: 'var(--tag-text-weight, 700)',
                                                border: '1px solid var(--tag-border)',
                                                boxShadow: 'var(--tag-shadow)'
                                            }}>
                                                <span className="name">{tag.name}</span>
                                            </div>
                                            <div className="item-actions">
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        setEditingId(tag.id);
                                                        setEditName(tag.name);
                                                        setEditColor(tag.color);
                                                    }}
                                                    className="btn-icon-v2"
                                                    title="Edit"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        handleDeleteTag(tag.id);
                                                    }}
                                                    className="btn-icon-v2 danger"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
};

export default TagManager;

import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Tag as TagIcon, ArrowDownAZ, TrendingUp, Calendar } from 'lucide-react';
import { type Tag as TagType, createTag, deleteTag, updateTag, getItems, type ContentItem, approveTag } from '../api';
import { useTags } from '../hooks/useTags';
import { Tag } from './Tag';

const TagManager = () => {
    const { allTags: tags, fetchTags } = useTags();
    const [tagUsage, setTagUsage] = useState<Record<string, number>>({});
    const [newTagName, setNewTagName] = useState<string>('');
    const [newTagColor, setNewTagColor] = useState<string>('#6366f1');
    const [loading, setLoading] = useState<boolean>(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState<string>('');
    const [editColor, setEditColor] = useState<string>('');

    const [filterText, setFilterText] = useState<string>('');
    const [sortMode, setSortMode] = useState<'alphabetical' | 'popularity' | 'date'>('alphabetical');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async (): Promise<void> => {
        setLoading(true);
        try {
            const [_, itemsData] = await Promise.all([fetchTags(), getItems()]);

            // Calculate usage count for each tag
            const usage: Record<string, number> = {};
            itemsData.forEach((item: ContentItem) => {
                (item.tags || []).forEach((t: TagType) => {
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

    const handleApproveTag = async (id: string): Promise<void> => {
        try {
            await approveTag(id);
            fetchData();
        } catch (error) {
            console.error('Error approving tag:', error);
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



    // Filter and Sort Tags
    const getProcessedTags = () => {
        // 1. Filter by text and approval (for cloud, maybe show all in list?)
        // The requirement is: "unapproved tags should not be displayed in the tag cloud"
        // But for "The list of tags", we might want to see them all?
        // Let's assume list view shows all but supports filtering. Cloud hides unapproved.

        return tags
            .filter(tag => tag.name.toLowerCase().includes(filterText.toLowerCase()))
            .sort((a, b) => {
                if (sortMode === 'alphabetical') {
                    return a.name.localeCompare(b.name);
                } else if (sortMode === 'popularity') {
                    const countA = tagUsage[a.id] || 0;
                    const countB = tagUsage[b.id] || 0;
                    return countB - countA;
                } else if (sortMode === 'date') {
                    // Fallback if created_at is missing (old tags)
                    const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
                    const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
                    return dateB - dateA;
                }
                return 0;
            });
    };

    const processedTags = getProcessedTags();


    return (
        <div className="tag-manager-dashboard fade-in">
            <div className="manager-header">
                <div>
                    <h2>Tag Index</h2>
                    <p className="subtitle">Curate and organize your digital collection.</p>
                </div>
                <div className="stats-mini">
                    <div className="stat-item">
                        <TagIcon size={16} />
                        <span>{tags.length} Unique Tags</span>
                    </div>
                </div>
            </div>

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
                    <div className="section-header-row">
                        <h3>All Tags</h3>
                        <div className="filter-controls">
                            <input
                                type="text"
                                placeholder="Filter tags..."
                                value={filterText}
                                onChange={(e) => setFilterText(e.target.value)}
                                className="filter-input-subtle"
                            />
                            <div className="sort-btn-group">
                                <button
                                    className={`sort-btn ${sortMode === 'alphabetical' ? 'active' : ''}`}
                                    onClick={() => setSortMode('alphabetical')}
                                    title="Sort A-Z"
                                >
                                    <ArrowDownAZ size={18} />
                                </button>
                                <button
                                    className={`sort-btn ${sortMode === 'popularity' ? 'active' : ''}`}
                                    onClick={() => setSortMode('popularity')}
                                    title="Sort by Popularity"
                                >
                                    <TrendingUp size={18} />
                                </button>
                                <button
                                    className={`sort-btn ${sortMode === 'date' ? 'active' : ''}`}
                                    onClick={() => setSortMode('date')}
                                    title="Sort by Date"
                                >
                                    <Calendar size={18} />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="tag-grid-scroll">
                        {loading ? (
                            <div className="loading-small">Loading tags...</div>
                        ) : (
                            processedTags.map((tag: TagType) => (
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
                                            <Tag
                                                tag={tag}
                                                onApprove={async (id) => handleApproveTag(id)}
                                                showApproveIcon={true}
                                            />
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

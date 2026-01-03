import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, ArrowDownAZ, ArrowUpAZ, TrendingUp, Calendar, ShieldCheck } from 'lucide-react';
import { type Tag as TagType, createTag, deleteTag, updateTag, getItems, type ContentItem, approveTag } from '../api';
import { useTags } from '../hooks/useTags';
import { Tag } from './Tag';
import { CreateTagModal } from './CreateTagModal';

const TagManager = () => {
    const { allTags: tags, fetchTags } = useTags();
    const [tagUsage, setTagUsage] = useState<Record<string, number>>({});

    const [loading, setLoading] = useState<boolean>(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState<string>('');
    const [editColor, setEditColor] = useState<string>('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    const [filterText, setFilterText] = useState<string>('');
    const [sortMode, setSortMode] = useState<'alphabetical' | 'popularity' | 'date'>('alphabetical');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [showApprovedOnly, setShowApprovedOnly] = useState<boolean>(false);

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

    const handleCreateTag = async (name: string, color: string): Promise<void> => {
        try {
            await createTag(name, color);
            fetchData();
        } catch (error) {
            console.error('Error creating tag:', error);
            throw error;
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


    const handleSortChange = (mode: 'alphabetical' | 'popularity' | 'date') => {
        if (sortMode === mode) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortMode(mode);
            setSortDirection('asc'); // Default to asc for new mode, or maybe desc for popularity?
            // Usually popularity is desc by default (most popular first).
            if (mode === 'popularity' || mode === 'date') {
                setSortDirection('desc');
            } else {
                setSortDirection('asc');
            }
        }
    };


    // Filter and Sort Tags
    const getProcessedTags = () => {
        let processed = tags;

        // 1. Text Filter
        if (filterText) {
            processed = processed.filter(tag => tag.name.toLowerCase().includes(filterText.toLowerCase()));
        }

        // 2. Approved Filter
        if (showApprovedOnly) {
            processed = processed.filter(tag => tag.is_approved);
        }

        // 3. Sort
        return processed.sort((a, b) => {
            let comparison = 0;
            if (sortMode === 'alphabetical') {
                comparison = a.name.localeCompare(b.name);
            } else if (sortMode === 'popularity') {
                const countA = tagUsage[a.id] || 0;
                const countB = tagUsage[b.id] || 0;
                comparison = countA - countB;
                if (comparison === 0) comparison = a.name.localeCompare(b.name);
            } else if (sortMode === 'date') {
                const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
                const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
                comparison = dateA - dateB;
                if (comparison === 0) comparison = a.name.localeCompare(b.name);
            }

            return sortDirection === 'asc' ? comparison : -comparison;
        });
    };

    const processedTags = getProcessedTags();


    return (
        <div className="tag-manager-dashboard fade-in">
            <div className="manager-header">
                <div>
                    <h2>Index</h2>
                    <p className="subtitle">Curate and organize your digital collection.</p>
                </div>

                <div className="filter-controls" style={{ marginLeft: 'auto', marginRight: '1rem' }}>
                    <input
                        type="text"
                        placeholder="Filter tags..."
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                        className="filter-input-subtle"
                    />
                    <div className="sort-btn-group">
                        <button
                            className={`sort-btn ${showApprovedOnly ? 'active' : ''}`}
                            onClick={() => setShowApprovedOnly(!showApprovedOnly)}
                            title="Show Approved Only"
                            style={{ borderRight: '1px solid var(--border-color)' }}
                        >
                            <ShieldCheck size={18} />
                        </button>
                        <button
                            className={`sort-btn ${sortMode === 'alphabetical' ? 'active' : ''}`}
                            onClick={() => handleSortChange('alphabetical')}
                            title="Sort A-Z"
                        >
                            {sortMode === 'alphabetical' && sortDirection === 'desc' ? <ArrowUpAZ size={18} /> : <ArrowDownAZ size={18} />}
                        </button>
                        <button
                            className={`sort-btn ${sortMode === 'popularity' ? 'active' : ''}`}
                            onClick={() => handleSortChange('popularity')}
                            title="Sort by Popularity"
                        >
                            <TrendingUp size={18} className={sortMode === 'popularity' && sortDirection === 'asc' ? 'icon-flipped' : ''} style={{ transform: sortMode === 'popularity' && sortDirection === 'asc' ? 'scaleY(-1)' : 'none' }} />
                        </button>
                        <button
                            className={`sort-btn ${sortMode === 'date' ? 'active' : ''}`}
                            onClick={() => handleSortChange('date')}
                            title="Sort by Date"
                        >
                            <Calendar size={18} />
                            {/* Indicator for date direction could be subtle or just rely on toggle behavior */}
                        </button>
                    </div>
                </div>
            </div>

            <div className="tag-management-grid">
                <section className="existing-tags-section">


                    <CreateTagModal
                        isOpen={isCreateModalOpen}
                        onClose={() => setIsCreateModalOpen(false)}
                        onCreate={handleCreateTag}
                    />

                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                        <div className="tag-grid-scroll" style={{ flex: 1 }}>
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

                        <button
                            className="btn-circle-add"
                            title="Add Tag"
                            onClick={() => setIsCreateModalOpen(true)}
                            style={{ width: '40px', height: '40px', borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 0, alignSelf: 'flex-start' }}
                        >
                            <Plus size={24} />
                        </button>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default TagManager;

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowDownAZ, ArrowUpAZ, Calendar, RefreshCw, X } from 'lucide-react';
import { type Tag as TagType, getItems, type ContentItem, searchContent, deleteItem, restartAllFailedTasks } from '../api';
import { useTags } from '../hooks/useTags';
import { Tag } from './Tag';
import { FileCard } from './FileCard';
import { ViewHeader } from './ViewHeader';
import { ViewContainer } from './ViewContainer';
import './Heap.css';

export const Heap = ({ 
    isActive = false, 
    pinnedItems = new Set(), 
    setPinnedItems = () => {},
    selectedItemId,
    onSelectItem
}: { 
    isActive?: boolean;
    pinnedItems?: Set<string>;
    setPinnedItems?: (items: Set<string>) => void;
    selectedItemId?: string | null;
    onSelectItem?: (id: string | null) => void;
}) => {

    const { allTags: tags, fetchTags } = useTags();
    const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
    const [allItems, setAllItems] = useState<ContentItem[]>([]);
    const [filterText, setFilterText] = useState<string>('');
    const [debouncedFilterText, setDebouncedFilterText] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [searching, setSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<{ tags: TagType[], items: ContentItem[] } | null>(null);
    // const [selectedItemId, setSelectedItemId] = useState<string | null>(null); <-- Lifted to App
    // const [pinnedItems, setPinnedItems] = useState<Set<string>>(new Set()); <-- Lifted to App
    const [sortMode, setSortMode] = useState<'alphabetical' | 'date'>('date');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const navigate = useNavigate();

    const handleSortChange = (mode: 'alphabetical' | 'date') => {
        if (sortMode === mode) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortMode(mode);
            setSortDirection('desc'); // Default to desc (newest/Z-A) usually better for exploration
            if (mode === 'alphabetical') {
                setSortDirection('asc'); // A-Z usually better for names
            }
        }
    };

    // Calculate usage count for each tag based on UNPINNED items
    const tagUsage = React.useMemo(() => {
        const usage: Record<string, number> = {};
        // Only use items that are NOT pinned for the tag cloud
        const itemsToConsider = allItems.filter(item => !pinnedItems.has(item.id));
        
        itemsToConsider.forEach((item: ContentItem) => {
            (item.tags || []).forEach((t: TagType) => {
                usage[t.id] = (usage[t.id] || 0) + 1;
            });
        });
        return usage;
    }, [allItems, pinnedItems]);

    // Initial load
    const fetchData = React.useCallback(async () => {
        setLoading(true);
        try {
            const [_, itemsData] = await Promise.all([fetchTags(), getItems()]);
            setAllItems(itemsData);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    }, [fetchTags]);

    useEffect(() => {
        if (isActive) {
            fetchData();
        }
    }, [isActive, fetchData]);

    // Debounce search text
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedFilterText(filterText);
        }, 300);
        return () => clearTimeout(timer);
    }, [filterText]);

    // Perform search when debounced text changes
    useEffect(() => {
        if (!debouncedFilterText.trim()) {
            setSearchResults(null);
            setSearching(false);
            fetchData(); // Ensure we are fresh when clearing search
            return;
        }

        const doSearch = async () => {
            setSearching(true);
            try {
                const results = await searchContent(debouncedFilterText);
                setSearchResults(results);
            } catch (error) {
                console.error("Search failed:", error);
            } finally {
                setSearching(false);
            }
        };

        doSearch();
    }, [debouncedFilterText, fetchData]);

    // Function to re-run the search (e.g., after deleting an item)
    const refreshSearch = async () => {
        if (!debouncedFilterText.trim()) {
            // If no search active, refresh the main view
            await fetchData();
            return;
        }

        try {
            const results = await searchContent(debouncedFilterText);
            setSearchResults(results);
        } catch (error) {
            console.error("Refresh search failed:", error);
        }
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!window.confirm("Are you sure you want to delete this item?")) return;

        try {
            await deleteItem(id);
            await deleteItem(id);
            // If the deleted item was selected, deselect it
            if (selectedItemId === id) {
                onSelectItem && onSelectItem(null);
            }

            // Refresh search results to remove the item
            refreshSearch();
        } catch (error) {
            console.error("Failed to delete item:", error);
            alert("Failed to delete item");
        }
    };

    const toggleTag = (tagId: string) => {
        const newSelected = new Set(selectedTags);
        if (newSelected.has(tagId)) {
            newSelected.delete(tagId);
        } else {
            newSelected.add(tagId);
        }
        setSelectedTags(newSelected);
    };

    const togglePin = (itemId: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const newPinned = new Set(pinnedItems);
        if (newPinned.has(itemId)) {
            newPinned.delete(itemId);
        } else {
            newPinned.add(itemId);
        }
        setPinnedItems(newPinned);
    };

    const getFilteredItems = () => {
        let items = filterText.trim() && searchResults ? searchResults.items : allItems;
        
        // Exclude pinned items from the main content grid
        items = items.filter(item => !pinnedItems.has(item.id));

        if (selectedTags.size > 0) {
            items = items.filter(item => {
                const itemTagIds = new Set((item.tags || []).map(t => t.id));
                // Intersection logic: Item must have ALL selected tags
                for (const tagId of selectedTags) {
                    if (!itemTagIds.has(tagId)) return false;
                }
                return true;
            });
        }

        
        return items.sort((a, b) => {
            let comparison = 0;
            if (sortMode === 'alphabetical') {
                // Helper to get title from metadata or fallback to filename
                const getTitle = (item: ContentItem) => {
                    try {
                        const meta = JSON.parse(item.metadata_json || '{}');
                        return meta.title || item.original_filename;
                    } catch {
                        return item.original_filename;
                    }
                };
                
                const nameA = getTitle(a);
                const nameB = getTitle(b);
                comparison = nameA.localeCompare(nameB);
            } else if (sortMode === 'date') {
                const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
                const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
                comparison = dateA - dateB;
            }
            
            return sortDirection === 'asc' ? comparison : -comparison;
        });
    };

    const handlePinAll = () => {
        const itemsToPin = getFilteredItems();
        if (itemsToPin.length === 0) return;

        const newPinned = new Set(pinnedItems);
        itemsToPin.forEach(item => newPinned.add(item.id));
        setPinnedItems(newPinned);
    };

    const hasActiveFilters = filterText.trim().length > 0 || selectedTags.size > 0;

    const getCloudTags = () => {
        // Default view: "top used and recent tags"
        return tags.filter(t => t.is_approved)
            .sort((a, b) => {
                const countA = tagUsage[a.id] || 0;
                const countB = tagUsage[b.id] || 0;
                // Primary sort: usage desc
                if (countB !== countA) return countB - countA;
                // Secondary sort: recent (created_at) desc
                const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
                const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
                return dateB - dateA;
            });
    };

    const visibleTagsRaw = filterText.trim() && searchResults ? searchResults.tags : getCloudTags();
    const visibleTags = visibleTagsRaw.filter(t => !selectedTags.has(t.id));
    const activeTagsList = tags.filter(t => selectedTags.has(t.id));

    const visibleItems = getFilteredItems();
    
    // Calculate failed tasks for visible items (including pinned)
    const failedTasksData = React.useMemo(() => {
        let count = 0;
        const taskIds: string[] = [];
        
        // Items to check: combined visible items + pinned items (if they aren't already in visible items)
        // getFilteredItems already excludes pinned items from the main list, so we need to add them back for calculation
        // if we want "filtered and pinned" as per requirements.
        
        const itemsToCheck = [...visibleItems];
        // Add pinned items
        pinnedItems.forEach(id => {
            const item = allItems.find(i => i.id === id);
            if (item) itemsToCheck.push(item);
        });

        itemsToCheck.forEach(item => {
            item.tasks?.forEach(t => {
                let isFailed = t.status === 'FAILED';
                if (!isFailed && t.status === 'COMPLETED' && t.result_json) {
                    try {
                        const res = JSON.parse(t.result_json);
                        if (res && res.status === 'failure') {
                            isFailed = true;
                        }
                    } catch (e) {}
                }

                if (isFailed) {
                    count++;
                    taskIds.push(t.id);
                }
            });
        });

        return { count, taskIds };
    }, [visibleItems, pinnedItems, allItems]);

    const failedTasksCount = failedTasksData.count;

    const handleRestartFailed = async () => {
        if (failedTasksCount === 0) return;
        
        try {
            await restartAllFailedTasks(failedTasksData.taskIds);
            // Ideally refresh tasks
            fetchData();
        } catch (error) {
            console.error("Failed to restart tasks:", error);
            alert("Failed to restart tasks");
        }
    };

    return (
        <ViewContainer>
            <ViewHeader
                title="The Heap"
                subtitle="Your unstructured pile of everything."
                controls={
                    <>
                        {failedTasksCount > 0 && (
                            <button
                                onClick={handleRestartFailed}
                                className="action-button"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.4rem 0.8rem',
                                    fontSize: '0.85rem',
                                    background: 'var(--surface-hover)',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: '0.5rem',
                                    cursor: 'pointer',
                                    color: 'var(--text-main)',
                                    marginRight: '1rem'
                                }}
                            >
                                <RefreshCw size={14} />
                                Restart Failed ({failedTasksCount})
                            </button>
                        )}
                        <div className="input-with-icon">
                            <Search size={16} className="input-icon" />
                            <input
                                type="text"
                                placeholder="Type to search..."
                                value={filterText}
                                onChange={(e) => setFilterText(e.target.value)}
                                className="filter-input-subtle"
                            />
                            {filterText && (
                                <button 
                                    className="input-clear-btn"
                                    onClick={() => setFilterText('')}
                                    title="Clear search"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                        <div className="sort-btn-group" style={{ marginLeft: '1rem', display: 'flex' }}>
                             <button
                                className={`sort-btn ${sortMode === 'alphabetical' ? 'active' : ''}`}
                                onClick={() => handleSortChange('alphabetical')}
                                title="Sort A-Z"
                            >
                                {sortMode === 'alphabetical' && sortDirection === 'desc' ? <ArrowUpAZ size={18} /> : <ArrowDownAZ size={18} />}
                            </button>
                            <button
                                className={`sort-btn ${sortMode === 'date' ? 'active' : ''}`}
                                onClick={() => handleSortChange('date')}
                                title="Sort by Date"
                            >
                                <Calendar size={18} />
                            </button>
                        </div>
                    </>
                }
            />

            <div className="heap-content">
                <div className="heap-layout">
                    {/* Left Column: Tags */}
                    <section className="heap-sidebar-left">
                        
                        {/* Active Filters Section */}
                        {selectedTags.size > 0 && (
                            <div className="active-tags-section" style={{ marginBottom: '1.5rem' }}>
                                <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', margin: '0 0 0.75rem 0', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    Active Filters
                                    <button
                                        onClick={() => {
                                            setSelectedTags(new Set());
                                            setFilterText('');
                                        }}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: 'var(--text-muted)',
                                            fontSize: '0.7rem',
                                            cursor: 'pointer',
                                            padding: 0,
                                            textTransform: 'none',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.25rem'
                                        }}
                                        className="hover:text-primary"
                                    >
                                        <X size={12} /> Clear All
                                    </button>
                                </h3>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
                                    {activeTagsList.map(tag => (
                                        <Tag
                                            key={`active-${tag.id}`}
                                            tag={tag}
                                            onClick={() => toggleTag(tag.id)}
                                            isSelected={true}
                                            style={{ fontSize: '0.8rem', padding: '0.35rem 0.8rem' }}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Available Tags Section */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', margin: 0, fontWeight: 700 }}>
                                Tags
                            </h3>
                            {searching && <div className="loading-small" style={{ fontSize: '0.7rem' }}>...</div>}
                        </div>

                        <div className="tags-column" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignContent: 'flex-start' }}>
                            {visibleTags.map((tag: TagType) => (
                                <Tag
                                    key={tag.id}
                                    tag={tag}
                                    className="cloud-tag"
                                    onClick={() => toggleTag(tag.id)}
                                    isSelected={selectedTags.has(tag.id)}
                                    style={{
                                        fontSize: '0.8rem',
                                        padding: '0.35rem 0.8rem',
                                        gap: '0.4rem',
                                        opacity: (selectedTags.has(tag.id) || filterText.trim() ? 1 : (tagUsage[tag.id] ? 1 : 0.6))
                                    }}
                                />
                            ))}
                            {visibleTags.length === 0 && filterText.trim() && (
                                <p className="empty-msg" style={{ fontSize: '0.8rem', paddingLeft: '0.25rem' }}>No matching tags.</p>
                            )}
                            {visibleTags.length === 0 && !filterText.trim() && (
                                <p className="empty-msg" style={{ fontSize: '0.8rem', paddingLeft: '0.25rem' }}>No tags found.</p>
                            )}
                        </div>
                    </section>

                    {/* Right Column: Content Area (Combined or Expanded) */}
                    {selectedItemId ? (
                        (() => {
                            const selectedItem = allItems.find(i => i.id === selectedItemId);
                            if (!selectedItem) return null; // Should not happen if state is consistent
                            return (
                                <section className="heap-center">
                                    <div style={{ marginBottom: '1rem' }}>
                                         <button 
                                            onClick={() => onSelectItem && onSelectItem(null)}
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
                                            ← Back to list
                                         </button>
                                    </div>
                                    <FileCard
                                        item={selectedItem}
                                        onDelete={handleDelete}
                                        onRefresh={refreshSearch}
                                        isSelected={true}
                                        onSelect={() => {}} 
                                        onDeselect={() => onSelectItem && onSelectItem(null)}
                                        isPinned={pinnedItems.has(selectedItem.id)}

                                        onTogglePin={togglePin}
                                    />
                                </section>
                            );
                        })()
                    ) : (
                        <>
                            {/* Right Column: Content */}
                            <section className="heap-center">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                        <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', margin: 0, fontWeight: 700 }}>
                                            Content
                                        </h3>
                                        {hasActiveFilters && getFilteredItems().length > 0 && (
                                            <button
                                                onClick={handlePinAll}
                                                style={{
                                                    background: 'var(--bg-card)',
                                                    border: '1px solid var(--border-subtle)',
                                                    borderRadius: '6px',
                                                    padding: '4px 8px',
                                                    fontSize: '0.75rem',
                                                    color: 'var(--text-primary)',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    fontWeight: 600
                                                }}
                                                title="Pin all visible items"
                                            >
                                                Pin All
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {loading && !searching ? (
                                    <div className="loading-small">Loading content...</div>
                                ) : (
                                    <div className="files-grid-fixed">
                                        {getFilteredItems().slice(0, 50).map((item: ContentItem) => (
                                            <FileCard
                                                key={item.id}
                                                item={item}
                                                onDelete={handleDelete}
                                                onRefresh={refreshSearch}
                                                isSelected={false} /* Always false in list view since selection moves to expanded view */
                                                onSelect={() => onSelectItem && onSelectItem(item.id)}
                                                onDeselect={() => onSelectItem && onSelectItem(null)}
                                                isPinned={pinnedItems.has(item.id)}

                                                onTogglePin={togglePin}
                                            />
                                        ))}

                                        {filterText.trim() && searchResults?.items.length === 0 && (
                                            <p className="empty-msg" style={{ fontSize: '0.8rem', paddingLeft: '0.25rem' }}>No matching content.</p>
                                        )}
                                        {!filterText.trim() && allItems.length === 0 && (
                                            <p className="empty-msg" style={{ fontSize: '0.8rem', paddingLeft: '0.25rem' }}>No content found.</p>
                                        )}
                                    </div>
                                )}
                            </section>

                            {/* Right Column: Pinned Files */}
                            {pinnedItems.size > 0 && (
                                <section className="heap-sidebar-right">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                    <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', margin: 0, fontWeight: 700 }}>
                                            Pinned Files ({pinnedItems.size})
                                        </h3>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button
                                                onClick={() => {
                                                    // Navigate to Notebooks tab with pinned items
                                                    // Since we are using state in App.tsx to switch tabs, we can use react-router navigate 
                                                    // but we might need to pass state that App.tsx listens to
                                                    // or simple use window.history.pushState? 
                                                    // Ideally we used a Router for tabs, but App.tsx uses local state.
                                                    // Let's use useNavigate which is available since Heap is inside Router
                                                    navigate('/', { 
                                                        state: { 
                                                            view: 'notebooks', 
                                                            createNotebook: true, 
                                                            pinnedItemIds: Array.from(pinnedItems) 
                                                        } 
                                                    });
                                                }}
                                                style={{ background: 'none', border: 'none', fontSize: '0.75rem', color: 'var(--primary)', cursor: 'pointer', padding: 0, fontWeight: 600 }}
                                            >
                                                + Create Notebook
                                            </button>
                                            <button
                                                onClick={() => setPinnedItems(new Set())}
                                                style={{ background: 'none', border: 'none', fontSize: '0.75rem', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                                            >
                                                Clear
                                            </button>
                                        </div>
                                    </div>

                                    <div className="pinned-items-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {allItems.filter(item => pinnedItems.has(item.id)).map(item => (
                                            <FileCard
                                                key={`pinned-${item.id}`}
                                                item={item}
                                                onDelete={handleDelete}
                                                onRefresh={refreshSearch}
                                                isSelected={false} /* Always false in list view */
                                                onSelect={() => onSelectItem && onSelectItem(item.id)}
                                                onDeselect={() => onSelectItem && onSelectItem(null)}
                                                isPinned={true}

                                                onTogglePin={togglePin}
                                                variant="micro"
                                            />
                                        ))}
                                    </div>
                                </section>
                            )}
                        </>
                    )}
                </div>
            </div>
        </ViewContainer>
    );
};

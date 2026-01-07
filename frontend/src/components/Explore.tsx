import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { type Tag as TagType, getItems, type ContentItem, searchContent, deleteItem } from '../api';
import { useTags } from '../hooks/useTags';
import { Tag } from './Tag';
import { FileCard } from './FileCard';
import { ViewHeader } from './ViewHeader';
import { ViewContainer } from './ViewContainer';

export const Explore = () => {
    const { allTags: tags, fetchTags } = useTags();
    const [tagUsage, setTagUsage] = useState<Record<string, number>>({});
    const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
    const [allItems, setAllItems] = useState<ContentItem[]>([]);
    const [filterText, setFilterText] = useState<string>('');
    const [debouncedFilterText, setDebouncedFilterText] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(true);
    const [searching, setSearching] = useState<boolean>(false);
    const [searchResults, setSearchResults] = useState<{ tags: TagType[], items: ContentItem[] } | null>(null);
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

    // Initial load
    const fetchData = React.useCallback(async () => {
        setLoading(true);
        try {
            const [_, itemsData] = await Promise.all([fetchTags(), getItems()]);
            setAllItems(itemsData);

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
    }, [fetchTags]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

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
            // If the deleted item was selected, deselect it
            if (selectedItemId === id) {
                setSelectedItemId(null);
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

    const getFilteredItems = () => {
        let items = filterText.trim() && searchResults ? searchResults.items : allItems;
        
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
        return items;
    };

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

    return (
        <ViewContainer>
            <ViewHeader
                title="Explore"
                subtitle="Discover connections in your collection."
                controls={
                    <div className="input-with-icon">
                        <Search size={16} className="input-icon" />
                        <input
                            type="text"
                            placeholder="Type to search..."
                            value={filterText}
                            onChange={(e) => setFilterText(e.target.value)}
                            className="filter-input-subtle"
                        />
                    </div>
                }
            />

            <div className="explore-content">
                <div className="search-layout" style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
                    {/* Left Column: Tags */}
                    <section className="results-section" style={{ width: '240px', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
                        
                        {/* Active Filters Section */}
                        {selectedTags.size > 0 && (
                            <div className="active-tags-section" style={{ marginBottom: '1.5rem' }}>
                                <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', margin: '0 0 0.75rem 0', fontWeight: 700 }}>
                                    Active Filters
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

                    {/* Right Column: Content */}
                    <section className="results-section" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', margin: 0, fontWeight: 700 }}>
                                Content
                            </h3>
                        </div>

                        {loading && !searching ? (
                            <div className="loading-small">Loading content...</div>
                        ) : (
                            <div className="items-grid" style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                                gap: '1.5rem'
                            }}>
                                {getFilteredItems().slice(0, 50).map((item: ContentItem) => (
                                    <FileCard
                                        key={item.id}
                                        item={item}
                                        onDelete={handleDelete}
                                        onRefresh={refreshSearch}
                                        isSelected={selectedItemId === item.id}
                                        onSelect={() => setSelectedItemId(item.id)}
                                        onDeselect={() => setSelectedItemId(null)}
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
                </div>
            </div>
        </ViewContainer>
    );
};

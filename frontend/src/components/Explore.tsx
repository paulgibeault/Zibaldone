import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { type Tag as TagType, getItems, type ContentItem, searchContent, deleteItem } from '../api';
import { useTags } from '../hooks/useTags';
import { Tag } from './Tag';
import { FileCard } from './FileCard';

export const Explore = () => {
    const { allTags: tags, fetchTags } = useTags();
    const [tagUsage, setTagUsage] = useState<Record<string, number>>({});
    const [allItems, setAllItems] = useState<ContentItem[]>([]);
    const [filterText, setFilterText] = useState<string>('');
    const [debouncedFilterText, setDebouncedFilterText] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(true);
    const [searching, setSearching] = useState<boolean>(false);
    const [searchResults, setSearchResults] = useState<{ tags: TagType[], items: ContentItem[] } | null>(null);
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

    // Initial load
    useEffect(() => {
        const fetchData = async () => {
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
        };
        fetchData();
    }, []);

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
    }, [debouncedFilterText]);

    // Function to re-run the search (e.g., after deleting an item)
    const refreshSearch = async () => {
        if (!debouncedFilterText.trim()) return;

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
            })
            .slice(0, 50);
    };

    return (
        <div className="explore-container fade-in">
            <div className="manager-header" style={{ alignItems: 'center', paddingBottom: '1rem', marginBottom: '0.5rem', borderBottom: 'none' }}>
                <div style={{ marginRight: '2rem' }}>
                    <h2 style={{ marginBottom: '0.25rem', fontSize: '2rem' }}>Explore</h2>
                    <p className="subtitle" style={{ margin: 0, fontSize: '0.9rem' }}>Discover connections in your collection.</p>
                </div>

                <div className="search-container" style={{ flex: 1, maxWidth: '500px' }}>
                    <div className="input-with-icon">
                        <Search size={16} className="input-icon" style={{ left: '10px' }} />
                        <input
                            type="text"
                            placeholder="Type to search..."
                            value={filterText}
                            onChange={(e) => setFilterText(e.target.value)}
                            style={{
                                padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                                width: '100%',
                                fontSize: '1rem',
                                borderRadius: '12px',
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border-subtle)'
                            }}
                        />
                    </div>
                </div>
            </div>

            <div className="explore-content">
                <div className="search-layout" style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
                    {/* Left Column: Tags */}
                    <section className="results-section" style={{ width: '240px', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', paddingLeft: '0.25rem' }}>
                            <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', margin: 0, fontWeight: 700 }}>
                                Tags
                            </h3>
                            {searching && <div className="loading-small" style={{ fontSize: '0.7rem' }}>...</div>}
                        </div>

                        <div className="tags-column" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignContent: 'flex-start' }}>
                            {(filterText.trim() && searchResults ? searchResults.tags : getCloudTags()).map((tag: TagType) => (
                                <Tag
                                    key={tag.id}
                                    tag={tag}
                                    className="cloud-tag"
                                    style={{
                                        fontSize: '0.8rem',
                                        padding: '0.35rem 0.8rem',
                                        gap: '0.4rem',
                                        opacity: (filterText.trim() ? 1 : (tagUsage[tag.id] ? 1 : 0.6))
                                    }}
                                />
                            ))}
                            {filterText.trim() && searchResults?.tags.length === 0 && (
                                <p className="empty-msg" style={{ fontSize: '0.8rem', paddingLeft: '0.25rem' }}>No matching tags.</p>
                            )}
                            {!filterText.trim() && getCloudTags().length === 0 && (
                                <p className="empty-msg" style={{ fontSize: '0.8rem', paddingLeft: '0.25rem' }}>No tags found.</p>
                            )}
                        </div>
                    </section>

                    {/* Right Column: Content */}
                    <section className="results-section" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', paddingLeft: '0.25rem' }}>
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
                                {(filterText.trim() && searchResults ? searchResults.items : allItems.slice(0, 20)).map((item: ContentItem) => (
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
        </div>
    );
};

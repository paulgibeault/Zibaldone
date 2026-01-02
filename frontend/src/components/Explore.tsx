import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { type Tag as TagType, getItems, type ContentItem } from '../api';
import { useTags } from '../hooks/useTags';
import { Tag } from './Tag';

export const Explore = () => {
    const { allTags: tags, fetchTags } = useTags();
    const [tagUsage, setTagUsage] = useState<Record<string, number>>({});
    const [filterText, setFilterText] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        const fetchData = async () => {
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
        fetchData();
    }, []);

    const getTagFontSize = (tagId: string): string => {
        const count = tagUsage[tagId] || 0;
        if (count === 0) return '0.85rem';
        const size = 0.85 + Math.min(count * 0.2, 1.5);
        return `${size}rem`;
    };

    const getDisplayTags = () => {
        let displayTags = tags.filter(t => t.is_approved);

        if (filterText.trim()) {
            // If user searches, match by text
            return displayTags.filter(t =>
                t.name.toLowerCase().includes(filterText.toLowerCase())
            );
        } else {
            // Default view: "top used and recent tags"
            // For now, let's sort by popularity (usage) and take top 50
            return displayTags
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
        }
    };

    const cloudTags = getDisplayTags();

    return (
        <div className="explore-container fade-in">
            <div className="manager-header">
                <div>
                    <h2>Explore</h2>
                    <p className="subtitle">Discover connections in your collection.</p>
                </div>
            </div>

            <div className="search-container" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'center' }}>
                <div className="input-with-icon" style={{ maxWidth: '500px', width: '100%' }}>
                    <Search size={18} className="input-icon" />
                    <input
                        type="text"
                        placeholder="Search tags..."
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                        className="big-search-input"
                        style={{ padding: '0.75rem 0.75rem 0.75rem 2.5rem', width: '100%', fontSize: '1.1rem', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-card)' }}
                    />
                </div>
            </div>

            <section className="word-cloud-section glass-panel">
                {loading ? (
                    <div className="loading-small">Loading tags...</div>
                ) : (
                    <div className="word-cloud">
                        {cloudTags.length === 0 ? (
                            <p className="empty-msg">No tags found.</p>
                        ) : (
                            cloudTags.map((tag: TagType) => (
                                <Tag
                                    key={tag.id}
                                    tag={tag}
                                    className="cloud-tag"
                                    style={{
                                        fontSize: getTagFontSize(tag.id),
                                        opacity: tagUsage[tag.id] ? 1 : 0.6
                                    }}
                                />
                            ))
                        )}
                    </div>
                )}
            </section>
        </div>
    );
};

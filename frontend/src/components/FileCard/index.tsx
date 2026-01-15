import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Pin, Loader2 } from 'lucide-react';
import axios from 'axios';
import { type ContentItem } from '../../api';
import { getFileCategory, getFileIcon, isTextBased } from '../../utils/fileTypes';
import { isTaskFailed, isRunningTask, isPendingTask } from '../../utils/taskUtils';
import { FileCardHeader } from './FileCardHeader';
import { FileCardContent } from './FileCardContent';
import { FileCardFooter } from './FileCardFooter';
import './FileCard.css';

type ViewMode = 'minimal' | 'standard' | 'fullscreen';

interface FileCardProps {
    item: ContentItem;
    onDelete: (id: string, e: React.MouseEvent) => void;
    onRefresh: () => void;
    isSelected: boolean;
    onSelect: () => void;
    onDeselect: () => void;
    isPinned?: boolean;
    onTogglePin?: (id: string, e: React.MouseEvent) => void;
    variant?: 'default' | 'micro';
}

export const FileCard: React.FC<FileCardProps> = ({ item, onDelete, onRefresh, isSelected, onSelect, onDeselect, isPinned, onTogglePin, variant = 'default' }) => {
    const [activeTab, setActiveTab] = useState<'info' | 'preview' | 'metadata'>('info');
    const [metadataView, setMetadataView] = useState<'rendered' | 'raw'>('rendered');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [textContent, setTextContent] = useState<string | null>(null);
    const [isLoadingContent, setIsLoadingContent] = useState(false);

    // Internal state for version switching
    const [currentItem, setCurrentItem] = useState<ContentItem>(item);
    const [versions, setVersions] = useState<ContentItem[]>([]);

    useEffect(() => {
        setCurrentItem(item);
    }, [item]);

    // Fetch versions when entering View tab or mounting if active
    useEffect(() => {
        if (activeTab === 'preview') {
            import('../../api').then(api => {
                api.getItemVersions(currentItem.id).then(setVersions).catch(console.error);
            });
        }
    }, [activeTab, currentItem.id]); // Re-fetch if we switch item context? Or maybe just on mount?
    // Actually, getting versions for 'currentItem.id' is tricky if we switch to an old version ID.
    // But 'getItemVersions' fetches by looking up Original Filename + Path. So any version ID works.

    // Update dependent variables to use currentItem
    const displayItem = currentItem;

    const viewMode: ViewMode = isFullscreen ? 'fullscreen' : (isSelected ? 'standard' : 'minimal');

    const metadata = useMemo(() => {
        try {
            return JSON.parse(displayItem.metadata_json || '{}');
        } catch (e) {
            console.error("Failed to parse metadata", e);
            return {};
        }
    }, [displayItem.metadata_json]);

    const fileCategory = useMemo(() => getFileCategory(metadata.type, displayItem.original_filename), [metadata.type, displayItem.original_filename]);

    useEffect(() => {
        const textBased = isTextBased(fileCategory);

        if (activeTab === 'preview' && textBased && displayItem.download_url && !textContent && !isLoadingContent) {
            // Reset content when item changes?
            // See dependency list.

            const fetchContent = async () => {
                setIsLoadingContent(true);
                try {
                    const url = displayItem.download_url!.startsWith('http')
                        ? displayItem.download_url!
                        : `http://${window.location.hostname}:8000${displayItem.download_url!}`;
                    const response = await axios.get(url, { responseType: 'text' });
                    setTextContent(response.data);
                } catch (err) {
                    console.error("Failed to fetch file content", err);
                    setTextContent("Error loading content.");
                } finally {
                    setIsLoadingContent(false);
                }
            };
            fetchContent();
        }
    }, [activeTab, displayItem.download_url, fileCategory, textContent, isLoadingContent, displayItem.id]);

    // Clear text content when item changes
    useEffect(() => {
        setTextContent(null);
    }, [displayItem.id]);

    const formatSize = useCallback((bytes?: number): string => {
        if (!bytes) return 'N/A';
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }, []);

    const formatMetadataKey = useCallback((key: string): string => {
        const specialCases: Record<string, string> = {
            'size': 'File Size',
            'lastModified': 'Last Modified',
            'lastModifiedDate': 'Modified Date',
            'type': 'Content Type',
            'sentiment': 'Sentiment'
        };
        if (specialCases[key]) return specialCases[key];
        return key
            .replace(/([A-Z])/g, ' $1')
            .replace(/[_-]/g, ' ')
            .replace(/^\w/, (c) => c.toUpperCase())
            .trim();
    }, []);

    const formatMetadataValue = useCallback((key: string, value: any): React.ReactNode => {
        if (value === null || value === undefined) return 'N/A';
        if (key === 'size') return formatSize(Number(value));
        if (key === 'lastModified' || key === 'lastModifiedDate') {
            try {
                const date = new Date(typeof value === 'number' ? value : String(value));
                if (!isNaN(date.getTime())) return date.toLocaleString();
            } catch (e) { }
        }
        if (key === 'sentiment') {
            const val = String(value).toLowerCase();
            return <span className={`sentiment-pill sentiment-${val}`}>{val}</span>;
        }
        return String(value);
    }, [formatSize]);

    const renderFileIcon = useCallback(() => {
        const Icon = getFileIcon(fileCategory);
        return <Icon className={`file-icon-${fileCategory}`} />;
    }, [fileCategory]);

    const renderMinimalView = () => {
        const sortedTags = [...(item.tags || [])].sort((a, b) => {
            const isUnapprovedA = a.is_autocreated && !a.is_approved;
            const isUnapprovedB = b.is_autocreated && !b.is_approved;
            if (isUnapprovedA !== isUnapprovedB) {
                return isUnapprovedA ? 1 : -1;
            }
            return a.name.localeCompare(b.name);
        });
        const tagsString = sortedTags.map(t => t.name).join(', ');

        return (
            <div className={`file-card-minimal ${variant === 'micro' ? 'file-card-micro' : ''}`} onClick={onSelect} title={`Tags: ${tagsString}`}>
                <div className="minimal-icon">
                    {renderFileIcon()}
                    
                    {(() => {
                        const failedCount = item.tasks?.filter(isTaskFailed).length || 0;
                        const runningCount = item.tasks?.filter(isRunningTask).length || 0;
                        const pendingCount = item.tasks?.filter(isPendingTask).length || 0;

                        const badges = [
                            { type: 'failed', count: failedCount, color: 'var(--color-danger)', icon: null },
                            { type: 'running', count: runningCount, color: 'var(--color-primary)', icon: <Loader2 size={10} className="spin" /> },
                            { type: 'pending', count: pendingCount, color: '#f59e0b', icon: null } // Warning color
                        ].filter(b => b.count > 0);

                        return (
                            <div style={{ position: 'absolute', top: -4, right: -4, display: 'flex', flexDirection: 'column-reverse', alignItems: 'center' }}>
                                {badges.map((badge, index) => {
                                    // Stack them: The first one (Failed) is visually on top (z-index highest).
                                    // We'll render them in reverse order of stacking in DOM, or manipulate z-index.
                                    // Actually, standard stacking context: last one is on top.
                                    // We want Failed on top. So if we render Failed LAST, it's on top.
                                    // But list is [Failed, Running, Pending].
                                    // So we should reverse map? Or set z-index manually.
                                    // User wants "icons to stack vertically... tightly overlapped"
                                    
                                    const zIndex = badges.length - index; 
                                    const offset = index * 4; // Shift down for each lower priority item
                                    
                                    return (
                                        <span 
                                            key={badge.type}
                                            title={`${badge.count} ${badge.type} Tasks`}
                                            style={{
                                                position: 'absolute',
                                                top: `${offset}px`, 
                                                right: 0, // Align right
                                                fontSize: '0.65rem',
                                                fontWeight: 700,
                                                color: 'white',
                                                background: badge.color,
                                                minWidth: '16px',
                                                height: '16px',
                                                borderRadius: '50%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                boxShadow: '0 0 0 2px var(--bg-card)',
                                                zIndex: zIndex,
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            {badge.icon ? (
                                                <>
                                                    {badge.count > 1 ? (
                                                        <span style={{ fontSize: '0.55rem', fontWeight: 800 }}>{badge.count}</span>
                                                    ) : badge.icon}
                                                </>
                                            ) : (
                                                 badge.count
                                            )}
                                        </span>
                                    );
                                })}
                            </div>
                        );
                    })()}
                </div>
                <div className="minimal-info">
                    <div className="minimal-filename" title={item.original_filename}>
                        {metadata.title || item.original_filename}
                    </div>
                    {variant !== 'micro' && sortedTags.length > 0 && (
                        <div className="minimal-tags-text">
                            {sortedTags.map((tag, index) => (
                                <React.Fragment key={tag.id}>
                                    <span
                                        className="text-tag"
                                        style={{ color: tag.color }}
                                    >
                                        {tag.name}
                                    </span>
                                    {index < sortedTags.length - 1 && <span className="tag-separator">, </span>}
                                </React.Fragment>
                            ))}
                        </div>
                    )}
                </div>
                <div className="minimal-actions">
                     {onTogglePin && (
                        <button
                            type="button"
                            className={`btn btn-ghost btn-icon pin-btn-minimal ${isPinned ? 'text-accent' : ''}`}
                            onClick={(e) => onTogglePin(item.id, e)}
                            title={isPinned ? "Unpin File" : "Pin File"}
                            style={{ padding: '4px', cursor: 'pointer' }}
                        >
                             <Pin size={16} fill={isPinned ? "currentColor" : "none"} />
                        </button>
                    )}
                    <span className={`status-dot status-${item.status}`} title={`Status: ${item.status}`} />
                </div>
            </div>
        );
    };

    const renderStandardView = (isFull: boolean = false) => (
        <div className={`file-card-inner ${isFull ? 'expanded-inner' : ''}`}>
            <FileCardHeader
                item={displayItem}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                isFullscreen={isFull}
                onToggleFullscreen={(e) => { e?.stopPropagation(); setIsFullscreen(!isFull); }}
                onClose={() => {
                    setIsFullscreen(false);
                    onDeselect();
                }}
                getFileIcon={renderFileIcon}
                formatSize={formatSize}
                isPinned={isPinned}
                onTogglePin={onTogglePin ? (e) => onTogglePin(item.id, e!) : undefined}
            />

            <FileCardContent
                item={displayItem}
                activeTab={activeTab}
                metadata={metadata}
                metadataView={metadataView}
                onMetadataViewChange={setMetadataView}
                textContent={textContent}
                isLoadingContent={isLoadingContent}
                formatMetadataKey={formatMetadataKey}
                formatMetadataValue={formatMetadataValue}
                onRefresh={onRefresh}
                itemVersions={versions}
                onVersionSelect={setCurrentItem}
            />

            <FileCardFooter
                itemId={displayItem.id}
                currentItemTags={displayItem.tags || []}
                onRefresh={onRefresh}
                onDelete={onDelete}
            />
        </div>
    );

    if (viewMode === 'fullscreen') {
        const closeFullscreen = () => setIsFullscreen(false);

        return (
            <div className="fullscreen-overlay" onClick={closeFullscreen}>
                <div className="fullscreen-container" onClick={(e) => e.stopPropagation()}>
                    <div className={`file-card-inner expanded-inner`}>
                        <FileCardHeader
                            item={displayItem}
                            activeTab={activeTab}
                            onTabChange={setActiveTab}
                            isFullscreen={true}
                            onToggleFullscreen={closeFullscreen}
                            onClose={() => {
                                closeFullscreen();
                                onDeselect();
                            }}
                            getFileIcon={renderFileIcon}
                            formatSize={formatSize}
                            isPinned={isPinned}
                            onTogglePin={onTogglePin ? (e) => onTogglePin(item.id, e!) : undefined}
                        />

                        <FileCardContent
                            item={displayItem}
                            activeTab={activeTab}
                            metadata={metadata}
                            metadataView={metadataView}
                            onMetadataViewChange={setMetadataView}
                            textContent={textContent}
                            isLoadingContent={isLoadingContent}
                            formatMetadataKey={formatMetadataKey}
                            formatMetadataValue={formatMetadataValue}
                            onRefresh={onRefresh}
                            itemVersions={versions}
                            onVersionSelect={setCurrentItem}
                        />

                        <FileCardFooter
                            itemId={displayItem.id}
                            currentItemTags={displayItem.tags || []}
                            onRefresh={onRefresh}
                            onDelete={onDelete}
                        />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`file-card mode-${viewMode} ${variant === 'micro' ? 'card-micro' : ''}`}>
            {viewMode === 'minimal' ? renderMinimalView() : renderStandardView(false)}
        </div>
    );
};

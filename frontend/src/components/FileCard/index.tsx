import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { type ContentItem } from '../../api';
import { getFileCategory, getFileIcon, isTextBased } from '../../utils/fileTypes';
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
}

export const FileCard: React.FC<FileCardProps> = ({ item, onDelete, onRefresh, isSelected, onSelect, onDeselect }) => {
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
            <div className="file-card-minimal" onClick={onSelect} title={`Tags: ${tagsString}`}>
                <div className="minimal-icon">
                    {renderFileIcon()}
                </div>
                <div className="minimal-info">
                    <div className="minimal-filename" title={item.original_filename}>
                        {metadata.title || item.original_filename}
                    </div>
                    {sortedTags.length > 0 && (
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
        <div className={`file-card mode-${viewMode}`}>
            {viewMode === 'minimal' ? renderMinimalView() : renderStandardView(false)}
        </div>
    );
};

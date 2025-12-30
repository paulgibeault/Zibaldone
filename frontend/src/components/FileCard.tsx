import React, { useState, useEffect } from 'react';
import {
    FileText,
    Trash2,
    Info,
    Database,
    Maximize2,
    Minimize2,
    X,
    FileImage,
    FileCode,
    FileAudio,
    FileVideo,
    Archive,
    File,
    Clock,
    HardDrive,
    Table,
    Code,
    Eye,
    FileSearch
} from 'lucide-react';
import { type ContentItem } from '../api';
import TagPicker from './TagPicker';
import { JSONView } from './JSONView';
import { MarkdownPreview } from './MarkdownPreview';
import axios from 'axios';
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

export const FileCard = ({ item, onDelete, onRefresh, isSelected, onSelect, onDeselect }: FileCardProps) => {
    const [activeTab, setActiveTab] = useState<'info' | 'preview' | 'metadata'>('info');
    const [metadataView, setMetadataView] = useState<'rendered' | 'raw'>('rendered');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [textContent, setTextContent] = useState<string | null>(null);
    const [isLoadingContent, setIsLoadingContent] = useState(false);

    const viewMode: ViewMode = isFullscreen ? 'fullscreen' : (isSelected ? 'standard' : 'minimal');

    // Parse metadata safely
    let metadata: Record<string, any> = {};
    try {
        metadata = JSON.parse(item.metadata_json || '{}');
    } catch (e) {
        console.error("Failed to parse metadata", e);
    }

    // Effect to fetch content for text-based files when in preview tab
    useEffect(() => {
        const isTextBased = (metadata.type || '').includes('text/') ||
            (metadata.type || '').includes('markdown') ||
            (metadata.type || '').includes('javascript') ||
            (metadata.type || '').includes('json') ||
            (metadata.type || '').includes('python') ||
            (metadata.type || '').includes('html') ||
            (metadata.type || '').includes('css');

        if (activeTab === 'preview' && isTextBased && item.download_url && !textContent && !isLoadingContent) {
            const fetchContent = async () => {
                setIsLoadingContent(true);
                try {
                    const url = item.download_url!.startsWith('http')
                        ? item.download_url!
                        : `http://${window.location.hostname}:8000${item.download_url!}`;
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
    }, [activeTab, item.download_url, metadata.type, textContent, isLoadingContent]);

    // Determine Icon based on file type
    const getFileIcon = (): React.ReactNode => {
        const type = (metadata.type || '').toLowerCase();
        if (type.startsWith('image/')) return <FileImage className="file-icon-img" />;
        if (type.startsWith('video/')) return <FileVideo className="file-icon-video" />;
        if (type.startsWith('audio/')) return <FileAudio className="file-icon-audio" />;
        if (type.includes('javascript') || type.includes('python') || type.includes('json') || type.includes('html') || type.includes('css')) {
            return <FileCode className="file-icon-code" />;
        }
        if (type.includes('zip') || type.includes('tar') || type.includes('gzip')) return <Archive className="file-icon-archive" />;
        if (type.includes('text/') || type.includes('markdown') || item.original_filename.toLowerCase().endsWith('.txt') || item.original_filename.toLowerCase().endsWith('.md')) return <FileText className="file-icon-text" />;
        return <File className="file-icon-default" />;
    };

    // Format file size
    const formatSize = (bytes?: number): string => {
        if (!bytes) return 'N/A';
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        return `${size.toFixed(1)} ${units[unitIndex]}`;
    };

    const formatMetadataKey = (key: string): string => {
        // Handle specific cases or convert camelCase/snake_case to Title Case
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
    };

    const formatMetadataValue = (key: string, value: any): React.ReactNode => {
        if (value === null || value === undefined) return 'N/A';

        if (key === 'size') return formatSize(Number(value));

        if (key === 'lastModified' || key === 'lastModifiedDate') {
            try {
                const date = new Date(typeof value === 'number' ? value : String(value));
                if (!isNaN(date.getTime())) {
                    return date.toLocaleString();
                }
            } catch (e) {
                return String(value);
            }
        }

        if (key === 'sentiment') {
            const val = String(value).toLowerCase();
            return (
                <span className={`sentiment-pill sentiment-${val}`}>
                    {val}
                </span>
            );
        }

        return String(value);
    };

    const toggleFullscreen = (e?: React.MouseEvent): void => {
        if (e) {
            e.stopPropagation();
        }
        setIsFullscreen(!isFullscreen);
    };


    const renderMinimalView = () => (
        <div className="file-card-minimal" onClick={onSelect}>
            <div className="minimal-icon">
                {getFileIcon()}
            </div>
            <div className="minimal-info">
                <div className="minimal-filename" title={item.original_filename}>
                    {item.original_filename}
                </div>
                <div className="minimal-tags">
                    {(item.tags || []).slice(0, 3).map(tag => (
                        <span
                            key={tag.id}
                            className="minimal-tag-pill"
                            style={{
                                backgroundColor: `color-mix(in srgb, ${tag.color}, transparent 80%)`,
                                borderColor: `color-mix(in srgb, ${tag.color}, transparent 60%)`,
                                color: tag.color
                            }}
                        >
                            {tag.name}
                        </span>
                    ))}
                    {(item.tags || []).length > 3 && (
                        <span className="minimal-tag-more">+{item.tags!.length - 3}</span>
                    )}
                </div>
            </div>
            <div className="minimal-actions">
                <span className={`status-dot status-${item.status}`} title={`Status: ${item.status}`} />
            </div>
        </div>
    );

    const renderStandardView = (isFull: boolean = false) => (
        <div className={`file-card-inner ${isFull ? 'expanded-inner' : ''}`}>
            <div className="card-header-v2">
                <div className="header-main-content">
                    <div className="header-left">
                        <div className="icon-wrapper">
                            {getFileIcon()}
                            <span className={`status-dot status-${item.status}`} title={`Status: ${item.status}`} />
                        </div>
                    </div>

                    <div className="header-info">
                        <div className="title-row">
                            <h3 className="filename" title={item.original_filename}>
                                {item.original_filename}
                            </h3>
                            <div className="card-tabs-nav-compact">
                                <button
                                    type="button"
                                    className={`tab-link ${activeTab === 'info' ? 'active' : ''}`}
                                    onClick={(e: React.MouseEvent) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setActiveTab('info');
                                    }}
                                    title="Main Info"
                                >
                                    <Info size={16} />
                                </button>
                                <button
                                    type="button"
                                    className={`tab-link ${activeTab === 'preview' ? 'active' : ''}`}
                                    onClick={(e: React.MouseEvent) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setActiveTab('preview');
                                    }}
                                    title="Preview Content"
                                >
                                    <Eye size={16} />
                                </button>
                                <button
                                    type="button"
                                    className={`tab-link ${activeTab === 'metadata' ? 'active' : ''}`}
                                    onClick={(e: React.MouseEvent) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setActiveTab('metadata');
                                    }}
                                    title="Metadata & JSON"
                                >
                                    <Database size={16} />
                                </button>
                            </div>
                        </div>
                        <div className="sub-details">
                            <span className="detail-item"><HardDrive size={12} /> {formatSize(metadata.size)}</span>
                            <span className="divider">|</span>
                            <span className="detail-item"><Clock size={12} /> {new Date(item.created_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>

                <div className="header-actions">
                    <button
                        type="button"
                        className="action-btn-card expand-btn"
                        onClick={(e: React.MouseEvent) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleFullscreen(e);
                        }}
                        title={isFull ? "Restore View" : "Fullscreen"}
                    >
                        {isFull ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                    </button>
                    <button
                        type="button"
                        className="action-btn-card minimize-btn"
                        onClick={(e: React.MouseEvent) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsFullscreen(false);
                            onDeselect();
                        }}
                        title="Close Selection"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>


            <div className="card-content-area-v2">
                {activeTab === 'info' && (
                    <div className="info-tab fade-in">
                        <div className="summary-section">
                            <h4>SUMMARY</h4>
                            <p className="summary-text">
                                {metadata.summary || "No summary available. Processing might still be in progress."}
                            </p>
                        </div>
                    </div>
                )}

                {activeTab === 'preview' && (
                    <div className="preview-tab fade-in">
                        <div className="preview-container">
                            {(() => {
                                const type = (metadata.type || '').toLowerCase();
                                const url = item.download_url ? (item.download_url.startsWith('http') ? item.download_url : `http://${window.location.hostname}:8000${item.download_url}`) : null;

                                if (!url) return <div className="preview-placeholder">No preview available</div>;

                                if (type.startsWith('image/')) {
                                    return <img src={url} alt={item.original_filename} className="preview-image" />;
                                }

                                if (type.startsWith('video/')) {
                                    return <video src={url} controls className="preview-video" />;
                                }

                                if (type.startsWith('audio/')) {
                                    return <audio src={url} controls className="preview-audio" />;
                                }

                                if (type === 'application/pdf') {
                                    return <iframe src={url} className="preview-pdf" title="PDF Preview" />;
                                }

                                if (type.includes('markdown')) {
                                    return (
                                        <div className="preview-markdown-wrapper">
                                            {isLoadingContent ? (
                                                <div className="preview-loading">Loading content...</div>
                                            ) : (
                                                <MarkdownPreview content={textContent || ''} />
                                            )}
                                        </div>
                                    );
                                }

                                if (type.includes('text/') || type.includes('javascript') || type.includes('json') || type.includes('python') || type.includes('html') || type.includes('css') || item.original_filename.toLowerCase().endsWith('.txt')) {
                                    return (
                                        <div className="preview-text-wrapper">
                                            {isLoadingContent ? (
                                                <div className="preview-loading">Loading content...</div>
                                            ) : (
                                                <pre className="raw-text-preview">{textContent}</pre>
                                            )}
                                        </div>
                                    );
                                }

                                return (
                                    <div className="preview-fallback">
                                        <FileSearch size={48} />
                                        <p>No preview available for this file type.</p>
                                        <a href={url} target="_blank" rel="noopener noreferrer" className="download-fallback-link">
                                            Open in new tab
                                        </a>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                )}

                {activeTab === 'metadata' && (
                    <div className="metadata-tab-container fade-in">
                        <div className="metadata-view-toggle">
                            <button
                                type="button"
                                className={`toggle-btn ${metadataView === 'rendered' ? 'active' : ''}`}
                                onClick={(e: React.MouseEvent) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setMetadataView('rendered');
                                }}
                                title="Rendered View"
                            >
                                <Table size={14} />
                            </button>
                            <button
                                type="button"
                                className={`toggle-btn ${metadataView === 'raw' ? 'active' : ''}`}
                                onClick={(e: React.MouseEvent) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setMetadataView('raw');
                                }}
                                title="Raw JSON"
                            >
                                <Code size={14} />
                            </button>
                        </div>

                        {metadataView === 'rendered' ? (
                            <div className="metadata-tab">
                                <div className="metadata-grid">
                                    {(Object.entries(metadata) as [string, any][]).map(([key, value]) => {
                                        if (key === 'summary' || key === 'tags') return null;
                                        return (
                                            <React.Fragment key={key}>
                                                <div className="meta-key">{formatMetadataKey(key)}</div>
                                                <div className="meta-value">{formatMetadataValue(key, value)}</div>
                                            </React.Fragment>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className="json-tab">
                                <JSONView data={metadata} />
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="card-footer-v2">
                <div className="inline-tag-picker-compact">
                    <TagPicker itemId={item.id} currentItemTags={item.tags || []} onRefresh={onRefresh} />
                </div>
                <button
                    type="button"
                    className="action-btn-card delete-btn-footer"
                    onClick={(e: React.MouseEvent) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onDelete(item.id, e);
                    }}
                    title="Delete file"
                >
                    <Trash2 size={18} />
                </button>
            </div>

        </div>
    );

    if (viewMode === 'fullscreen') {
        return (
            <div className="fullscreen-overlay" onClick={() => setIsFullscreen(false)}>
                <div className="fullscreen-container" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                    {renderStandardView(true)}
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

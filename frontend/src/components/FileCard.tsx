import React, { useState } from 'react';
import {
    FileText,
    Trash2,
    Info,
    Database,
    FileJson,
    Maximize2,
    X,
    FileImage,
    FileCode,
    FileAudio,
    FileVideo,
    Archive,
    File,
    Clock,
    HardDrive
} from 'lucide-react';
import { type ContentItem } from '../api';
import TagPicker from './TagPicker';
import { JSONView } from './JSONView';
import './FileCard.css';

interface FileCardProps {
    item: ContentItem;
    onDelete: (id: string, e: React.MouseEvent) => void;
    onRefresh: () => void;
}

export const FileCard: React.FC<FileCardProps> = ({ item, onDelete, onRefresh }) => {
    const [activeTab, setActiveTab] = useState<'info' | 'metadata' | 'json'>('info');
    const [isExpanded, setIsExpanded] = useState(false);

    // Parse metadata safely
    let metadata: Record<string, any> = {};
    try {
        metadata = JSON.parse(item.metadata_json || '{}');
    } catch (e) {
        console.error("Failed to parse metadata", e);
    }

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
        if (type.includes('text/') || type.includes('markdown')) return <FileText className="file-icon-text" />;
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

    const toggleExpand = (e: React.MouseEvent): void => {
        e.stopPropagation();
        setIsExpanded(!isExpanded);
    };

    const cardContent = (
        <div className={`file-card-inner ${isExpanded ? 'expanded-inner' : ''}`}>
            <div className="card-header">
                <div className="header-main">
                    <div className="icon-wrapper">
                        {getFileIcon()}
                    </div>
                    <div className="title-area">
                        <h3 className="filename" title={item.original_filename}>
                            {item.original_filename}
                        </h3>
                        <div className="sub-details">
                            <span className="detail-item"><HardDrive size={12} /> {formatSize(metadata.size)}</span>
                            <span className="divider">•</span>
                            <span className="detail-item"><Clock size={12} /> {new Date(item.created_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>
                <div className="header-actions">
                    <button className="action-btn expand-btn" onClick={toggleExpand} title={isExpanded ? "Close" : "Expand"}>
                        {isExpanded ? <X size={18} /> : <Maximize2 size={18} />}
                    </button>
                    <button
                        className="action-btn delete-btn"
                        onClick={(e: React.MouseEvent) => onDelete(item.id, e)}
                        title="Delete file"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            </div>

            <div className="card-tabs-nav">
                <button
                    className={`tab-link ${activeTab === 'info' ? 'active' : ''}`}
                    onClick={() => setActiveTab('info')}
                >
                    <Info size={14} /> Main Info
                </button>
                <button
                    className={`tab-link ${activeTab === 'metadata' ? 'active' : ''}`}
                    onClick={() => setActiveTab('metadata')}
                >
                    <Database size={14} /> Metadata
                </button>
                <button
                    className={`tab-link ${activeTab === 'json' ? 'active' : ''}`}
                    onClick={() => setActiveTab('json')}
                >
                    <FileJson size={14} /> JSON
                </button>
            </div>

            <div className="card-content-area">
                {activeTab === 'info' && (
                    <div className="info-tab fade-in">
                        <div className="summary-section">
                            <h4>LLM Summary</h4>
                            <p className="summary-text">
                                {metadata.summary || "No summary available. Processing might still be in progress."}
                            </p>
                        </div>
                        {metadata.sentiment && (
                            <div className="sentiment-badge" data-sentiment={metadata.sentiment}>
                                Sentiment: {metadata.sentiment}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'metadata' && (
                    <div className="metadata-tab fade-in">
                        <div className="metadata-grid">
                            {Object.entries(metadata).map(([key, value]) => {
                                if (key === 'summary' || key === 'tags') return null;
                                return (
                                    <React.Fragment key={key}>
                                        <div className="meta-key">{key}</div>
                                        <div className="meta-value">{String(value)}</div>
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>
                )}

                {activeTab === 'json' && (
                    <div className="json-tab fade-in">
                        <JSONView data={metadata} />
                    </div>
                )}
            </div>

            <div className="card-footer-tags">
                <TagPicker itemId={item.id} currentItemTags={item.tags || []} onRefresh={onRefresh} />
                <span className={`status-dot status-${item.status}`} title={`Status: ${item.status}`} />
            </div>
        </div>
    );

    if (isExpanded) {
        return (
            <div className="fullscreen-overlay" onClick={toggleExpand}>
                <div className="fullscreen-container" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                    {cardContent}
                </div>
            </div>
        );
    }

    return (
        <div className="file-card">
            {cardContent}
        </div>
    );
};

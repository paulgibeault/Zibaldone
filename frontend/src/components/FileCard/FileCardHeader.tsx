import React from 'react';
import { Maximize2, Minimize2, X, Info, Eye, Database, Pin } from 'lucide-react';
import { type ContentItem } from '../../api';

interface FileCardHeaderProps {
    item: ContentItem;
    activeTab: 'info' | 'preview' | 'metadata';
    onTabChange: (tab: 'info' | 'preview' | 'metadata') => void;
    isFullscreen: boolean;
    onToggleFullscreen: (e?: React.MouseEvent) => void;
    onClose: () => void;
    getFileIcon: () => React.ReactNode;
    formatSize: (bytes?: number) => string;
    isPinned?: boolean;
    onTogglePin?: (e?: React.MouseEvent) => void;
}

export const FileCardHeader: React.FC<FileCardHeaderProps> = ({
    item,
    activeTab,
    onTabChange,
    isFullscreen,
    onToggleFullscreen,
    onClose,
    getFileIcon,
    formatSize,
    isPinned,
    onTogglePin
}) => {
    // Parse metadata safely (already parsed in parent usually, but for robustness)
    let size = 0;
    let title = item.original_filename;
    try {
        const meta = JSON.parse(item.metadata_json || '{}');
        size = meta.size;
        if (meta.title) title = meta.title;
    } catch (e) { }

    return (
        <div className="card-header-v2">
            <div className="header-main-content">
                <div className="header-left">
                    <div className="icon-wrapper">
                        {getFileIcon()}
                        <span className={`status-dot status-${item.status.toLowerCase()}`} title={`Status: ${item.status}`} />
                    </div>
                </div>

                <div className="header-info">
                    <div className="title-row">
                        <h3 className="filename" title={item.original_filename}>
                            {title}
                        </h3>
                        
                        <div className="compact-meta">
                             <span className="version-badge-compact">v{item.version}</span>
                             <span className="divider">•</span>
                             <span className="meta-text">{formatSize(size)}</span>
                             {item.client_file_path && (
                                <>
                                    <span className="divider">•</span>
                                    <span className="source-path-compact" title={item.client_file_path}>
                                        {item.client_file_path}
                                    </span>
                                </>
                             )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="header-actions-group">
                 <div className="card-tabs-nav-compact">
                    <button
                        type="button"
                        className={`tab-link ${activeTab === 'info' ? 'active' : ''}`}
                        onClick={(e) => { e.stopPropagation(); onTabChange('info'); }}
                        title="Main Info"
                    >
                        <Info size={16} />
                        {item.status === 'PROCESSING' && <span className="tab-indicator processing-indicator" />}
                        {item.status === 'FAILED' && <span className="tab-indicator failed-indicator" />}
                    </button>
                    <button
                        type="button"
                        className={`tab-link ${activeTab === 'preview' ? 'active' : ''}`}
                        onClick={(e) => { e.stopPropagation(); onTabChange('preview'); }}
                        title="Preview Content"
                    >
                        <Eye size={16} />
                    </button>
                    <button
                        type="button"
                        className={`tab-link ${activeTab === 'metadata' ? 'active' : ''}`}
                        onClick={(e) => { e.stopPropagation(); onTabChange('metadata'); }}
                        title="Metadata & JSON"
                    >
                        <Database size={16} />
                    </button>
                </div>

                <div className="divider-vertical" />

                <div className="action-buttons">
                    {onTogglePin && (
                        <button
                            type="button"
                            className={`btn btn-ghost btn-icon pin-btn ${isPinned ? 'text-accent' : ''}`}
                            onClick={onTogglePin}
                            title={isPinned ? "Unpin File" : "Pin File"}
                        >
                            <Pin size={18} fill={isPinned ? "currentColor" : "none"} />
                        </button>
                    )}
                    <button
                        type="button"
                        className="btn btn-ghost btn-icon expand-btn"
                        onClick={onToggleFullscreen}
                        title={isFullscreen ? "Restore View" : "Fullscreen"}
                    >
                        {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                    </button>
                    <button
                        type="button"
                        className="btn btn-ghost btn-icon minimize-btn"
                        onClick={onClose}
                        title="Close Selection"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};

import React, { useState } from 'react';
import { FileText, Trash2, Info, Database, Calendar, HardDrive, File as FileIcon } from 'lucide-react';
import { type ContentItem } from '../api';
import './FileCard.css';

interface FileCardProps {
    item: ContentItem;
    onDelete: (id: string, e: React.MouseEvent) => void;
}

export const FileCard: React.FC<FileCardProps> = ({ item, onDelete }) => {
    const [activeTab, setActiveTab] = useState<'info' | 'metadata'>('info');

    // Parse metadata safely
    let metadata: Record<string, any> = {};
    try {
        metadata = JSON.parse(item.metadata_json || '{}');
    } catch (e) {
        console.error("Failed to parse metadata", e);
    }

    // Format file size
    const formatSize = (bytes?: number) => {
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

    return (
        <div className="file-card">
            <div className="card-header">
                <FileIcon size={24} className="file-icon" />
                <h3 className="filename" title={item.original_filename}>
                    {item.original_filename}
                </h3>
                <button
                    className="delete-btn"
                    onClick={(e) => onDelete(item.id, e)}
                    title="Delete file"
                >
                    <Trash2 size={18} />
                </button>
            </div>

            <div className="card-body">
                {activeTab === 'info' ? (
                    <div className="info-grid">
                        <span className="info-label"><HardDrive size={14} style={{ verticalAlign: 'text-bottom' }} /> Size</span>
                        <span className="info-value">{formatSize(metadata.size)}</span>

                        <span className="info-label"><FileText size={14} style={{ verticalAlign: 'text-bottom' }} /> Type</span>
                        <span className="info-value" title={metadata.type || 'Unknown'}>
                            {(metadata.type || 'Unknown').split('/')[1]?.toUpperCase() || 'FILE'}
                        </span>

                        <span className="info-label"><Calendar size={14} style={{ verticalAlign: 'text-bottom' }} /> Created</span>
                        <span className="info-value">
                            {new Date(item.created_at).toLocaleDateString()}
                        </span>

                        <span className="info-label">Time</span>
                        <span className="info-value">
                            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                ) : (
                    <div className="metadata-preview">
                        <pre className="metadata-pre">
                            {JSON.stringify(metadata, null, 2)}
                        </pre>
                    </div>
                )}
            </div>

            <div className="card-footer">
                <div className="tab-nav">
                    <button
                        className={`tab-btn ${activeTab === 'info' ? 'active' : ''}`}
                        onClick={() => setActiveTab('info')}
                        title="Main Info"
                    >
                        <Info size={16} />
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'metadata' ? 'active' : ''}`}
                        onClick={() => setActiveTab('metadata')}
                        title="Raw Metadata"
                    >
                        <Database size={16} />
                    </button>
                </div>
                <span className={`status-indicator status-${item.status}`}>
                    {item.status}
                </span>
            </div>
        </div>
    );
};

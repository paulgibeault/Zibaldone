import React from 'react';
import { Table, Code } from 'lucide-react';
import { type ContentItem } from '../../api';
import { JSONView } from '../JSONView';
import { FilePreview } from './FilePreview';

interface FileCardContentProps {
    item: ContentItem;
    activeTab: 'info' | 'preview' | 'metadata';
    metadata: Record<string, any>;
    metadataView: 'rendered' | 'raw';
    onMetadataViewChange: (view: 'rendered' | 'raw') => void;
    textContent: string | null;
    isLoadingContent: boolean;
    formatMetadataKey: (key: string) => string;
    formatMetadataValue: (key: string, value: any) => React.ReactNode;
}

export const FileCardContent: React.FC<FileCardContentProps> = ({
    item,
    activeTab,
    metadata,
    metadataView,
    onMetadataViewChange,
    textContent,
    isLoadingContent,
    formatMetadataKey,
    formatMetadataValue
}) => {
    return (
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
                        <FilePreview
                            item={item}
                            metadata={metadata}
                            textContent={textContent}
                            isLoadingContent={isLoadingContent}
                        />
                    </div>
                </div>
            )}

            {activeTab === 'metadata' && (
                <div className="metadata-tab-container fade-in">
                    <div className="metadata-view-toggle">
                        <button
                            type="button"
                            className={`toggle-btn ${metadataView === 'rendered' ? 'active' : ''}`}
                            onClick={(e) => { e.stopPropagation(); onMetadataViewChange('rendered'); }}
                            title="Rendered View"
                        >
                            <Table size={14} />
                        </button>
                        <button
                            type="button"
                            className={`toggle-btn ${metadataView === 'raw' ? 'active' : ''}`}
                            onClick={(e) => { e.stopPropagation(); onMetadataViewChange('raw'); }}
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
    );
};

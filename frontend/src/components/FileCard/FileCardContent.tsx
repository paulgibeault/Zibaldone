import React from 'react';
import { Table, Code, CheckCircle2, Clock, XCircle, Loader2 } from 'lucide-react';
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
    const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(null);

    const selectedTask = React.useMemo(() =>
        item.tasks?.find(t => t.id === selectedTaskId),
        [item.tasks, selectedTaskId]
    );

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

                    {item.tasks && item.tasks.length > 0 && (
                        <div className="history-section">
                            <h4>PROCESSING HISTORY</h4>
                            <div className="history-list">
                                {item.tasks.map(task => (
                                    <div
                                        key={task.id}
                                        className={`history-item ${task.result_json ? 'clickable' : ''}`}
                                        onClick={() => task.result_json && setSelectedTaskId(task.id)}
                                        title={task.result_json ? "Click to view details" : ""}
                                    >
                                        <div className="history-status">
                                            {task.status === 'COMPLETED' && <CheckCircle2 size={14} className="status-icon-completed" />}
                                            {task.status === 'RUNNING' && <Loader2 size={14} className="status-icon-running spin" />}
                                            {task.status === 'FAILED' && <XCircle size={14} className="status-icon-failed" />}
                                            {task.status === 'PENDING' && <Clock size={14} className="status-icon-pending" />}
                                        </div>
                                        <div className="history-details">
                                            <div className="history-name-row">
                                                <span className="history-name">{task.name}</span>
                                                <span className="history-status-text">{task.status}</span>
                                            </div>
                                            {task.message && <div className="history-message">{task.message}</div>}
                                            <div className="history-time">
                                                {new Date(task.start_time).toLocaleString()}
                                                {task.end_time && ` - ${new Date(task.end_time).toLocaleTimeString()}`}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {selectedTask && (
                        <div className="task-details-overlay fade-in" onClick={() => setSelectedTaskId(null)}>
                            <div className="task-details-modal" onClick={e => e.stopPropagation()}>
                                <div className="task-details-header">
                                    <h4>{selectedTask.name} Result</h4>
                                    <button className="close-btn" onClick={() => setSelectedTaskId(null)}>
                                        <XCircle size={16} />
                                    </button>
                                </div>
                                <div className="task-details-body">
                                    <JSONView data={selectedTask.result_json} />
                                </div>
                            </div>
                        </div>
                    )}
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

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
    onRefresh: () => void;
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
    formatMetadataValue,
    onRefresh
}) => {
    const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(null);
    const [isEditing, setIsEditing] = React.useState(false);
    const [editMetadata, setEditMetadata] = React.useState<Record<string, any>>({});
    const [isSaving, setIsSaving] = React.useState(false);

    const selectedTask = React.useMemo(() =>
        item.tasks?.find(t => t.id === selectedTaskId),
        [item.tasks, selectedTaskId]
    );

    const handleStartEdit = () => {
        // Filter out tags from the editor
        const { tags, ...rest } = metadata;
        setEditMetadata(rest);
        setIsEditing(true);
        // Force raw view for editing if desired, or keep as is?
        // Let's keep it in the "rendered" container but show inputs
        onMetadataViewChange('rendered');
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setEditMetadata({});
    };

    const handleSaveEdit = async () => {
        setIsSaving(true);
        try {
            // Re-merge with original tags if needed? No, backend handles it?
            // Wait, we are sending the whole metadata object.
            // If we send it without 'tags', and the backend just overwrites 'metadata_json',
            // then 'tags' key will be lost from 'metadata_json'.
            // This is INTENTIONAL as per the plan to unlink tags from metadata.

            // However, we should be careful not to lose other things?
            // The user sees what they edit.

            await import('../../api').then(m => m.updateItemMetadata(item.id, editMetadata));
            setIsEditing(false);
            onRefresh();
        } catch (e) {
            console.error("Failed to save metadata", e);
            alert("Failed to save metadata");
        } finally {
            setIsSaving(false);
        }
    };

    const handleMetadataChange = (key: string, value: string) => {
        setEditMetadata(prev => ({ ...prev, [key]: value }));
    };

    const handleDeleteField = (keyToDelete: string) => {
        const newMeta = { ...editMetadata };
        delete newMeta[keyToDelete];
        setEditMetadata(newMeta);
    };

    const handleAddField = () => {
        let counter = 1;
        while (editMetadata[`newField${counter}`] !== undefined) {
            counter++;
        }
        setEditMetadata(prev => ({ ...prev, [`newField${counter}`]: "" }));
    };

    const handleRenameKey = (oldKey: string, newKey: string) => {
        if (oldKey === newKey) return;
        if (editMetadata[newKey] !== undefined) {
            alert("Key already exists!");
            return;
        }

        const newMeta: Record<string, any> = {};
        // Preserve order
        Object.keys(editMetadata).forEach(k => {
            if (k === oldKey) {
                newMeta[newKey] = editMetadata[oldKey];
            } else {
                newMeta[k] = editMetadata[k];
            }
        });
        setEditMetadata(newMeta);
    };

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
                        {!isEditing && (
                            <>
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
                            </>
                        )}
                        {!isEditing ? (
                            <button
                                type="button"
                                className="toggle-btn"
                                onClick={(e) => { e.stopPropagation(); handleStartEdit(); }}
                                style={{ marginLeft: 'auto' }}
                            >
                                Edit
                            </button>
                        ) : (
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                Editing Metadata
                            </span>
                        )}
                    </div>

                    {isEditing ? (
                        <div className="metadata-tab">
                            <div className="metadata-editor-form">
                                {Object.entries(editMetadata).map(([key, value]) => (
                                    <div key={key} className="metadata-edit-row">
                                        <input
                                            type="text"
                                            value={key}
                                            onChange={(e) => handleRenameKey(key, e.target.value)}
                                            style={{ width: '120px', flex: '0 0 auto' }}
                                        />
                                        <input
                                            type="text"
                                            value={String(value)}
                                            onChange={(e) => handleMetadataChange(key, e.target.value)}
                                        />
                                        <button
                                            type="button"
                                            className="delete-btn"
                                            onClick={() => handleDeleteField(key)}
                                            title="Delete field"
                                        >
                                            <XCircle size={16} />
                                        </button>
                                    </div>
                                ))}
                                <button type="button" className="btn-add-field" onClick={handleAddField}>
                                    + Add Field
                                </button>
                                <div className="metadata-actions">
                                    <button type="button" className="btn-primary-sm" onClick={handleSaveEdit} disabled={isSaving}>
                                        {isSaving ? 'Saving...' : 'Save Changes'}
                                    </button>
                                    <button type="button" className="btn-secondary-sm" onClick={handleCancelEdit} disabled={isSaving}>
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        metadataView === 'rendered' ? (
                            <div className="metadata-tab">
                                <div className="metadata-grid">
                                    {(Object.entries(metadata) as [string, any][]).map(([key, value]) => {
                                        if (key === 'tags') return null; // 'summary' is showed in rendered view if present?
                                        // The original code hid 'summary' too, maybe that's fine.
                                        // "if (key === 'summary' || key === 'tags') return null;"
                                        // Let's stick to hiding summary in the grid if it's shown in info tab.
                                        if (key === 'summary') return null;

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
                        )
                    )}
                </div>
            )}
        </div>
    );
};

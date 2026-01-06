import React from 'react';
import { useUploadQueue } from '../stores/useUploadQueue';
import type { UploadItem } from '../stores/useUploadQueue';
import { X, RefreshCw, Trash2, ChevronUp, ChevronDown, AlertTriangle } from 'lucide-react';
import './UploadStatus.css';
import { IdentityConflictModal } from './IdentityConflictModal';

export const UploadStatus: React.FC = () => {
    const { queue, retry, remove, clearCompleted, resolveConflict } = useUploadQueue();
    const [isExpanded, setIsExpanded] = React.useState(true);
    const [conflictItem, setConflictItem] = React.useState<UploadItem | null>(null);

    if (queue.length === 0) return null;

    const pendingCount = queue.filter((i: UploadItem) => i.status === 'pending').length;
    const uploadingCount = queue.filter((i: UploadItem) => i.status === 'uploading').length;
    const errorCount = queue.filter((i: UploadItem) => i.status === 'error').length;
    const completedCount = queue.filter((i: UploadItem) => i.status === 'completed').length;
    const conflictCount = queue.filter((i: UploadItem) => i.status === 'conflict').length;
    
    return (
        <>
            <div className={`upload-status-container ${isExpanded ? 'expanded' : 'collapsed'}`}>
                <div className="upload-header" onClick={() => setIsExpanded(!isExpanded)}>
                    <div className="status-summary">
                        {uploadingCount > 0 ? (
                            <span className="spinner">⟳</span>
                        ) : (
                            <span>✓</span>
                        )}
                        <span className="summary-text">
                            {uploadingCount > 0 
                                ? `Uploading ${uploadingCount} items (${pendingCount} pending)`
                                : `Done: ${completedCount}${errorCount ? `, Errors: ${errorCount}` : ''}${conflictCount ? `, Conflicts: ${conflictCount}` : ''}`
                            }
                        </span>
                    </div>
                    <div className="header-actions">
                         {(completedCount > 0 || errorCount > 0) && (
                            <button 
                                className="icon-btn" 
                                onClick={(e) => { e.stopPropagation(); clearCompleted(); }}
                                title="Clear Completed"
                            >
                               <Trash2 size={14} />
                            </button>
                        )}
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                    </div>
                </div>

                {isExpanded && (
                    <div className="upload-list">
                        {queue.map((item: UploadItem) => (
                            <div key={item.id} className={`upload-item ${item.status}`}>
                                <div className="item-info">
                                    <span className="item-name" title={item.path}>{item.path}</span>
                                    <span className="item-status">
                                        {item.status === 'error' ? item.error : 
                                         item.status === 'conflict' ? 'Conflict Detected' :
                                         item.status}
                                    </span>
                                </div>
                                <div className="item-actions">
                                    {item.status === 'conflict' && (
                                        <button onClick={() => setConflictItem(item)} title="Resolve Conflict" className="btn-resolve">
                                            <AlertTriangle size={14} color="orange" />
                                        </button>
                                    )}
                                    {item.status === 'error' && (
                                        <button onClick={() => retry(item.id)} title="Retry"><RefreshCw size={14} /></button>
                                    )}
                                    <button onClick={() => remove(item.id)} title="Remove"><X size={14} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <IdentityConflictModal
                isOpen={!!conflictItem}
                fileName={conflictItem?.file.name || ''}
                onResolve={(resolution) => {
                    if (conflictItem) {
                        resolveConflict(conflictItem.id, resolution);
                        setConflictItem(null);
                    }
                }}
                onCancel={() => setConflictItem(null)}
            />
        </>
    );
};

import React, { useState } from 'react';
import { Modal } from '../Modal';
import { ProcessingTask } from '../../api/types';
import { XCircle, CheckCircle, Clock, AlertTriangle, FileText, Activity } from 'lucide-react';
import { getTaskProcessingStatus } from '../../api';
import './TaskManager.css'; // Reuse existing styles or create new ones
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { CopyButton } from '../CopyButton';

interface TaskDetailModalProps {
    tasks: ProcessingTask[];
    onClose: () => void;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ tasks, onClose }) => {
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(tasks.length === 1 ? tasks[0].id : null);

    // If multiple tasks, showing a list first might be good, or just a split view. 
    // Let's go with a sidebar if multiple, or just a list if no selection.
    
    // If only one task, it's auto-selected.
    
    const selectedTask = tasks.find(t => t.id === selectedTaskId) || (tasks.length === 1 ? tasks[0] : null);

    const getStatusIcon = (status: string, size = 20) => {
        switch (status) {
            case 'COMPLETED': return <CheckCircle size={size} className="text-success" />;
            case 'FAILED': return <XCircle size={size} className="text-danger" />;
            case 'RUNNING': return <Activity size={size} className="text-primary spin" />;
            default: return <Clock size={size} className="text-muted" />;
        }
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleString();
    };

    const getDuration = (start: string, end?: string) => {
        const startTime = new Date(start).getTime();
        const endTime = end ? new Date(end).getTime() : Date.now();
        const diff = Math.floor((endTime - startTime) / 1000);
        if (diff < 60) return `${diff}s`;
        const mins = Math.floor(diff / 60);
        const secs = diff % 60;
        return `${mins}m ${secs}s`;
    };

    const renderJson = (data: any) => {
        if (!data) return <span className="text-muted">None</span>;
        
        let jsonString = '';
        try {
            jsonString = JSON.stringify(data, null, 2);
        } catch (e) {
            jsonString = String(data);
        }

        return (
            <div className="json-viewer-container">
                 <CopyButton text={jsonString}>
                    <SyntaxHighlighter
                        language="json"
                        style={vscDarkPlus}
                        showLineNumbers={true}
                        customStyle={{ margin: 0, borderRadius: '6px', fontSize: '12px' }}
                    >
                        {jsonString}
                    </SyntaxHighlighter>
                </CopyButton>
            </div>
        );
    };

    const renderTaskList = () => (
        <div className="task-selection-list">
            <h4>Select a Task</h4>
            <div className="task-list-items">
                {tasks.map(task => (
                    <div 
                        key={task.id} 
                        className={`task-list-item ${selectedTaskId === task.id ? 'selected' : ''}`}
                        onClick={() => setSelectedTaskId(task.id)}
                    >
                        <div className="item-icon">{getStatusIcon(task.status)}</div>
                        <div className="item-info">
                            <div className="item-name">{task.name}</div>
                            <div className="item-time">{formatDate(task.start_time)}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderTaskDetail = (task: ProcessingTask) => (
        <div className="task-detail-content">
            {tasks.length > 1 && (
                <button className="back-to-list-btn" onClick={() => setSelectedTaskId(null)}>
                    ← Back to List
                </button>
            )}
            
            <div className="detail-header">
                <div className="detail-title-row">
                    <h3>{task.name}</h3>
                    <span className={`task-status-badge ${task.status.toLowerCase()}`}>
                        {getStatusIcon(task.status, 14)}
                        {task.status}
                    </span>
                </div>
                <div className="detail-meta-row">
                    <div className="meta-item" title="Start Time">
                        <Clock size={14} /> {formatDate(task.start_time)}
                    </div>
                    {task.end_time && (
                         <div className="meta-item" title="End Time">
                            <CheckCircle size={14} /> {formatDate(task.end_time)}
                        </div>
                    )}
                    <div className="meta-item" title="Duration">
                        <Activity size={14} /> {getDuration(task.start_time, task.end_time)}
                    </div>
                </div>
            </div>

            {task.message && (
                <div className={`detail-message alert ${task.status === 'FAILED' ? 'alert-danger' : 'alert-info'}`}>
                    {task.status === 'FAILED' && <AlertTriangle size={16} />}
                    <span>{task.message}</span>
                </div>
            )}

            <div className="detail-section">
                <h4>Parameters</h4>
                {renderJson(task.parameters)}
            </div>

            {(task.result_json || task.provenance_output) && (
                <div className="detail-section">
                    <h4>Results & Provenance</h4>
                    {task.result_json && (
                        <div className="subsection">
                            <h5>Result</h5>
                            {renderJson(typeof task.result_json === 'string' ? JSON.parse(task.result_json) : task.result_json)}
                        </div>
                    )}
                    {task.provenance_output && (
                         <div className="subsection">
                            <h5>Provenance</h5>
                            {renderJson(task.provenance_output)}
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title={null}
            width={tasks.length > 1 && !selectedTask ? '500px' : 'fit-content'}
            className="task-detail-modal"
        >
            {selectedTask ? renderTaskDetail(selectedTask) : renderTaskList()}
        </Modal>
    );
};

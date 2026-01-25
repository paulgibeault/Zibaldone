import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Play, XCircle, Trash2, ExternalLink, PauseCircle, PlayCircle } from 'lucide-react';
import { fetchTasks, cancelTask, restartTask, deleteTask, pauseTaskProcessing, resumeTaskProcessing, getTaskProcessingStatus } from '../../api';
import { ProcessingTask } from '../../api/types';
import { TaskDetailModal } from './TaskDetailModal';
import './TaskManager.css';

interface TaskListProps {
    refreshTrigger?: number;
    onOpenFile: (itemId: string) => void;
}

export const TaskList: React.FC<TaskListProps> = ({ refreshTrigger, onOpenFile }) => {
    const [tasks, setTasks] = useState<ProcessingTask[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [isPaused, setIsPaused] = useState<boolean>(false);
    const [isProcessingAction, setIsProcessingAction] = useState(false);
    const [selectedTasks, setSelectedTasks] = useState<ProcessingTask[] | null>(null);


    const loadTasks = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await fetchTasks({ limit: 100 });
            setTasks(data);
            
            // Also fetch status
            try {
                const statusData = await getTaskProcessingStatus();
                setIsPaused(statusData.status === 'paused');
            } catch (e) {
                console.error("Failed to fetch processor status", e);
            }
            
            // Collect unique item IDs to fetch filenames if needed
            // Backend now includes nested item info in response
        } catch (error) {
            console.error("Failed to load tasks", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadTasks();
        // Auto-refresh every 5 seconds if modal is open (and tasks are running)
        // If we are showing duration for running tasks, we might want faster refresh or local tick
        // But for now 1s refresh is fine for "seconds" resolution
        const interval = setInterval(() => {
             loadTasks();
        }, 1000); 
        return () => clearInterval(interval);
    }, [loadTasks, refreshTrigger]);


    const handleCancel = async (taskId: string) => {
        if (!confirm("Are you sure you want to cancel this task?")) return;
        try {
            await cancelTask(taskId);
            loadTasks();
        } catch (e) {
            alert("Failed to cancel task");
        }
    };

    const handleRestart = async (taskId: string) => {
        try {
            await restartTask(taskId);
            loadTasks();
        } catch (e) {
            alert("Failed to restart task");
        }
    };

    const handleDelete = async (taskId: string) => {
        if (!confirm("Delete this task record?")) return;
        try {
            await deleteTask(taskId);
            loadTasks();
        } catch (e) {
            alert("Failed to delete task");
        }
    };

    const getDuration = (start: string, end?: string) => {
        const startTime = new Date(start).getTime();
        const endTime = end ? new Date(end).getTime() : Date.now();
        const diff = Math.floor((endTime - startTime) / 1000);
        
        if (diff < 0) return '0s'; // Clock skew protection

        if (diff < 60) return `${diff}s`;
        const mins = Math.floor(diff / 60);
        const secs = diff % 60;
        return `${mins}m ${secs}s`;
    };

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedTasks = React.useMemo(() => {
        let sortableTasks = [...tasks];
        if (sortConfig !== null) {
            sortableTasks.sort((a, b) => {
                let aValue: any = a[sortConfig.key as keyof ProcessingTask];
                let bValue: any = b[sortConfig.key as keyof ProcessingTask];

                // Special handling for calculated duration if needed, 
                // but checking schema, we have start_time/end_time.
                
                // Special handling for file name sort
                if (sortConfig.key === 'item_name') {
                    // Derive the same string we display in the cell
                    aValue = a.item?.item_metadata?.title || a.item?.original_filename || a.item_id;
                    bValue = b.item?.item_metadata?.title || b.item?.original_filename || b.item_id;
                    
                    // Case insensitive string comparison
                    aValue = (aValue || '').toLowerCase();
                    bValue = (bValue || '').toLowerCase();
                }

                if (aValue < bValue) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableTasks;
    }, [tasks, sortConfig]);

    const getSortIndicator = (key: string) => {
        if (!sortConfig || sortConfig.key !== key) return null;
        return sortConfig.direction === 'asc' ? ' ▲' : ' ▼';
    };

    const togglePause = async () => {
        setIsProcessingAction(true);
        try {
            if (isPaused) {
                await resumeTaskProcessing();
                setIsPaused(false);
            } else {
                await pauseTaskProcessing();
                setIsPaused(true);
            }
            // Reload tasks immediately to reflect any state changes if needed, 
            // though usually status is separate.
            loadTasks();
        } catch (e) {
            console.error("Failed to toggle pause state", e);
            alert("Failed to toggle system pause state");
        } finally {
            setIsProcessingAction(false);
        }
    };

    return (
        <div className="task-manager-content">

            <div className="task-list-header">
                <h3>System Tasks</h3>
                <div className="task-list-controls">
                    <button 
                        className={`control-btn ${isPaused ? 'resume-btn' : 'pause-btn'}`} 
                        onClick={togglePause}
                        disabled={isProcessingAction}
                        title={isPaused ? "Resume Task Processing" : "Pause Task Processing"}
                    >
                        {isPaused ? <PlayCircle size={24} /> : <PauseCircle size={24} />}
                    </button>

                    <button className="refresh-btn" onClick={loadTasks} disabled={isLoading}>
                        <RefreshCw size={14} className={isLoading ? "spin" : ""} />
                        Refresh
                    </button>
                </div>
            </div>

            <div className="task-list-container custom-scrollbar">
                <table className="task-table">
                    <thead>
                        <tr>
                            <th 
                                className={`col-name clickable ${sortConfig?.key === 'name' ? 'active-sort' : ''}`} 
                                onClick={() => handleSort('name')}
                                title="Sort by Task Name"
                            >
                                Task Name {getSortIndicator('name')}
                            </th>
                            <th 
                                className={`col-id clickable ${sortConfig?.key === 'item_name' ? 'active-sort' : ''}`}
                                onClick={() => handleSort('item_name')}
                                title="Sort by File Name"
                            >
                                Target File {getSortIndicator('item_name')}
                            </th>
                            <th 
                                className={`col-status clickable ${sortConfig?.key === 'status' ? 'active-sort' : ''}`}
                                onClick={() => handleSort('status')}
                                title="Sort by Status"
                            >
                                Status {getSortIndicator('status')}
                            </th>
                            <th 
                                className={`col-time clickable ${sortConfig?.key === 'start_time' ? 'active-sort' : ''}`}
                                onClick={() => handleSort('start_time')}
                                title="Sort by Start Time"
                            >
                                Started {getSortIndicator('start_time')}
                            </th>
                            <th className="col-time">Duration</th>
                            <th className="col-actions">Actions</th>
                        </tr>
                    </thead>

                    <tbody>
                        {sortedTasks.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="empty-state">
                                    No tasks found.
                                </td>
                            </tr>
                        ) : (
                            sortedTasks.map(task => (
                                <TaskRow 
                                    key={task.id} 
                                    task={task} 
                                    onCancel={handleCancel} 
                                    onRestart={handleRestart} 
                                    onDelete={handleDelete}
                                    getDuration={getDuration}
                                    onOpenFile={onOpenFile}
                                    onClick={() => setSelectedTasks([task])}
                                />
                            ))
                        )}
                    </tbody>


                </table>
            </div>

            {selectedTasks && (
                <TaskDetailModal 
                    tasks={selectedTasks} 
                    onClose={() => setSelectedTasks(null)} 
                />
            )}
        </div>
    );
};

interface TaskRowProps {
    task: ProcessingTask;
    onCancel: (id: string) => void;
    onRestart: (id: string) => void;
    onDelete: (id: string) => void;
    getDuration: (start: string, end?: string) => string;
    onOpenFile: (id: string) => void;
    onClick: () => void;
}

const TaskRow: React.FC<TaskRowProps> = ({ task, onCancel, onRestart, onDelete, getDuration, onOpenFile, onClick }) => {
    return (
        <tr className="task-row" onClick={(e) => {
            // Prevent triggering if clicking on specific interactive elements handled elsewhere
            // (Like the File Link or Action buttons, though they are usually stopPropagation-ed)
            // But let's just put it on the row and rely on children stopPropagation
            onClick();
        }}>
            <td className="col-name">
                <div style={{ fontWeight: 500 }}>{task.name}</div>
                {/* Error message moved to tooltip on status, so we remove it from here matching user request */}
            </td>
            <td 
                className="col-id clickable" 
                onClick={(e) => { e.stopPropagation(); onOpenFile(task.item_id); }}
                title={`View '${task.item?.item_metadata?.title || task.item?.original_filename || task.item_id}'`}
            >
                <div className="file-info-cell">
                    <span className="text-truncate">
                        {task.item?.item_metadata?.title || task.item?.original_filename || task.item_id.substring(0, 8) + '...'}
                    </span>
                    <ExternalLink size={12} style={{flexShrink: 0, opacity: 0.5}}/>
                </div>
            </td>
            <td className="col-status">
                <span 
                    className={`task-status-badge ${task.status.toLowerCase()}`}
                    title={task.message || task.status} // Tooltip for error info
                >
                    {task.status}
                </span>
            </td>
            <td className="col-time">
                {new Date(task.start_time).toLocaleString(undefined, {
                    month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit', second: '2-digit'
                })}
            </td>
            <td className="col-time">
                {/* Show duration for running tasks too */}
                <span style={{ 
                    color: (task.status === 'RUNNING') ? 'var(--primary)' : 'inherit',
                    fontWeight: (task.status === 'RUNNING') ? 500 : 400
                }}>
                    {getDuration(task.start_time, task.end_time)}
                </span>
            </td>
            <td className="col-actions">
                <div className="task-actions">
                    {(task.status === 'RUNNING' || task.status === 'PENDING') && (
                        <button 
                            className="action-btn danger"
                            onClick={(e) => { e.stopPropagation(); onCancel(task.id); }}
                            title="Cancel Task"
                        >
                            <XCircle size={20} />
                        </button>
                    )}
                    {(task.status === 'FAILED' || task.status === 'COMPLETED') && (
                        <button 
                            className="action-btn primary"
                            onClick={(e) => { e.stopPropagation(); onRestart(task.id); }}
                            title="Restart Task"
                        >
                            <Play size={20} />
                        </button>
                    )}
                    <button 
                        className="action-btn"
                        onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
                        title="Delete Record"
                    >
                        <Trash2 size={20} />
                    </button>
                </div>
            </td>
        </tr>
    );
};

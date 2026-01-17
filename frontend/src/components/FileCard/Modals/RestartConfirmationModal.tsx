import React, { useState, useEffect } from 'react';
import { XCircle } from 'lucide-react';

interface RestartConfirmationModalProps {
    taskId: string;
    onClose: () => void;
    onConfirm: (taskId: string, dontAskAgain: boolean) => Promise<void>;
}

export const RestartConfirmationModal: React.FC<RestartConfirmationModalProps> = ({ taskId, onClose, onConfirm }) => {
    const [dontAskRestart, setDontAskRestart] = useState(false);

    const handleConfirm = async () => {
        await onConfirm(taskId, dontAskRestart);
    };

    return (
        <div className="task-details-overlay fade-in" onClick={onClose}>
            <div className="task-details-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                <div className="task-details-header">
                    <h4>Confirm Restart</h4>
                    <button className="close-btn" onClick={onClose}>
                        <XCircle size={16} />
                    </button>
                </div>
                <div className="task-details-body" style={{ padding: '1.5rem', background: 'var(--bg-card)' }}>
                    <p style={{ marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
                        Are you sure you want to restart this task?
                    </p>
                    
                    <label style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px', 
                        marginBottom: '1.5rem',
                        cursor: 'pointer',
                        color: 'var(--text-secondary)',
                        fontSize: '0.9rem'
                    }}>
                        <input 
                            type="checkbox" 
                            checked={dontAskRestart}
                            onChange={e => setDontAskRestart(e.target.checked)}
                            style={{ width: '16px', height: '16px' }}
                        />
                        Don't ask me again
                    </label>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button 
                            className="btn btn-outline-secondary btn-sm"
                            onClick={onClose}
                        >
                            Cancel
                        </button>
                        <button 
                            className="btn btn-primary btn-sm"
                            onClick={handleConfirm}
                        >
                            Restart
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

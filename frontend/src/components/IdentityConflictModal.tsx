import React from 'react';

interface IdentityConflictModalProps {
    isOpen: boolean;
    fileName: string;
    onResolve: (resolution: 'new_version' | 'new_file') => void;
    onCancel: () => void;
}

export const IdentityConflictModal: React.FC<IdentityConflictModalProps> = ({
    isOpen,
    fileName,
    onResolve,
    onCancel
}) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content conflict-modal">
                <h2>Naming Conflict</h2>
                <p>
                    A file named <strong>{fileName}</strong> already exists, but it looks different (e.g. signature mismatch).
                    How would you like to proceed?
                </p>
                <div className="modal-actions">
                    <button
                        className="btn-pills secondary"
                        onClick={() => onResolve('new_version')}
                        title="Treat as the next version of the existing file"
                    >
                        New Version
                    </button>
                    <button
                        className="btn-pills primary"
                        onClick={() => onResolve('new_file')}
                        title="Treat as a completely separate file (version 1)"
                    >
                        New File
                    </button>
                    <button
                        className="btn-pills ghost"
                        onClick={onCancel}
                    >
                        Cancel
                    </button>
                </div>
            </div>
            <style>{`
                .conflict-modal {
                    max-width: 500px;
                }
                .conflict-modal p {
                    margin-bottom: 2rem;
                    line-height: 1.5;
                    color: var(--text-secondary);
                }
                .conflict-modal strong {
                    color: var(--text-primary);
                }
                .modal-actions {
                    display: flex;
                    gap: 1rem;
                    justify-content: flex-end;
                }
            `}</style>
        </div>
    );
};

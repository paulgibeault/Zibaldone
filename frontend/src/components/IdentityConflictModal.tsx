import React from 'react';
import { Modal } from './Modal';

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
    return (
        <Modal
            isOpen={isOpen}
            onClose={onCancel}
            title="Naming Conflict"
            width="600px"
        >
            <p style={{ marginBottom: '2rem', lineHeight: '1.5', color: 'var(--text-secondary)' }}>
                A file named <strong style={{ color: 'var(--text-primary)' }}>{fileName}</strong> already exists, but it looks different (e.g. signature mismatch).
                How would you like to proceed?
            </p>
            <div className="modal-footer">
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
        </Modal>
    );
};

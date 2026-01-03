import React, { useState } from 'react';
import './CreateTagModal.css';

interface CreateTagModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (name: string, color: string) => Promise<void>;
}

export const CreateTagModal: React.FC<CreateTagModalProps> = ({ isOpen, onClose, onCreate }) => {
    const [name, setName] = useState('');
    const [color, setColor] = useState('#6366f1');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setIsSubmitting(true);
        try {
            await onCreate(name, color);
            setName('');
            onClose();
        } catch (error) {
            console.error('Failed to create tag:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="create-tag-modal-overlay" onClick={onClose}>
            <div className="create-tag-modal" onClick={e => e.stopPropagation()}>
                <h2>Create New Tag</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="tagName">Tag Name</label>
                        <input
                            id="tagName"
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="e.g., project-alpha"
                            autoFocus
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="tagColor">Tag Color</label>
                        <div className="color-picker-row">
                            <input
                                id="tagColor"
                                type="color"
                                value={color}
                                onChange={e => setColor(e.target.value)}
                                className="color-pill"
                            />
                            <div
                                className="color-preview"
                                style={{ backgroundColor: color }}
                            />
                        </div>
                    </div>
                    <div className="modal-actions">
                        <button
                            type="button"
                            className="btn-cancel"
                            onClick={onClose}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn-create"
                            disabled={!name.trim() || isSubmitting}
                        >
                            {isSubmitting ? 'Creating...' : 'Create Tag'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

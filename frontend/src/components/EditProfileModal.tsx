import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { updateUserProfile } from '../api';
import './EditProfileModal.css';

interface EditProfileModalProps {
    onClose: () => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ onClose }) => {
    const { user, updateUser } = useAuth();
    const [displayName, setDisplayName] = useState(user?.display_name || '');
    const [profileColor, setProfileColor] = useState(user?.profile_color || '#6366f1');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const colors = [
        '#6366f1', // Indigo
        '#ef4444', // Red
        '#f59e0b', // Amber
        '#10b981', // Emerald
        '#3b82f6', // Blue
        '#8b5cf6', // Violet
        '#ec4899', // Pink
        '#14b8a6', // Teal
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const updatedUser = await updateUserProfile({
                display_name: displayName,
                profile_color: profileColor
            });
            updateUser(updatedUser);
            onClose();
        } catch (err: any) {
            setError('Failed to update profile');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="modal-backdrop">
            <div className="modal-content">
                <h2>Edit Profile</h2>
                {error && <div className="error-message">{error}</div>}
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Display Name</label>
                        <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            required
                            className="input-field"
                        />
                    </div>

                    <div className="form-group">
                        <label>Profile Color</label>
                        <div className="color-grid">
                            {colors.map(color => (
                                <button
                                    type="button"
                                    key={color}
                                    className={`color-option ${profileColor === color ? 'selected' : ''}`}
                                    style={{ backgroundColor: color }}
                                    onClick={() => setProfileColor(color)}
                                    aria-label={`Select color ${color}`}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="modal-actions">
                        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
                        <button type="submit" disabled={isLoading} className="btn-primary">
                            {isLoading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

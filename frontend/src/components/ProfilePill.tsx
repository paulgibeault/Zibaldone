import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { EditProfileModal } from './EditProfileModal';
import { LogOut, Settings } from 'lucide-react';
import './ProfilePill.css';

export const ProfilePill: React.FC = () => {
    const { user, logout } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    if (!user) return null;

    return (
        <div className="profile-pill-container">
            <button
                className="profile-pill"
                onClick={() => setIsOpen(!isOpen)}
                style={{ backgroundColor: 'var(--bg-secondary)' }}
            >
                <div
                    className="profile-avatar"
                    style={{ backgroundColor: user.profile_color || '#6366f1' }}
                >
                    {user.display_name.charAt(0).toUpperCase()}
                </div>
                <span className="profile-name">{user.display_name}</span>
            </button>

            {isOpen && (
                <>
                    <div
                        className="profile-dropdown-backdrop"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="profile-dropdown">
                        <button onClick={() => {
                            setIsOpen(false);
                            setIsEditModalOpen(true);
                        }}>
                            <Settings size={16} />
                            Edit Profile
                        </button>
                        <button onClick={() => {
                            setIsOpen(false);
                            logout();
                        }}>
                            <LogOut size={16} />
                            Sign Out
                        </button>
                    </div>
                </>
            )}

            {isEditModalOpen && (
                <EditProfileModal
                    onClose={() => setIsEditModalOpen(false)}
                />
            )}
        </div>
    );
};

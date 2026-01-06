import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { updateUserProfile } from '../api';
import { getSessions, revokeSession, createDeviceInvite, createUserInvite, type Session } from '../api/endpoints/auth';
import './EditProfileModal.css';
import { Modal } from './Modal';

interface EditProfileModalProps {
    onClose: () => void;
}

type Tab = 'general' | 'devices' | 'admin';

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ onClose }) => {
    const { user, updateUser } = useAuth();
    const [activeTab, setActiveTab] = useState<Tab>('general');
    
    // General State
    const [displayName, setDisplayName] = useState(user?.display_name || '');
    const [profileColor, setProfileColor] = useState(user?.profile_color || '#6366f1');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // Devices State
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loadingSessions, setLoadingSessions] = useState(false);

    // Admin State
    const [inviteResult, setInviteResult] = useState<{ code: string; expires_at: string; user_id?: string } | null>(null);
    const [newUserName, setNewUserName] = useState('');

    // Load sessions when Devices tab is active
    useEffect(() => {
        if (activeTab === 'devices') {
            loadSessions();
        }
    }, [activeTab]);

    const loadSessions = async () => {
        setLoadingSessions(true);
        try {
            const data = await getSessions();
            setSessions(data);
        } catch (err) {
            console.error(err);
            setError('Failed to load sessions');
        } finally {
            setLoadingSessions(false);
        }
    };

    const handleRevokeSession = async (sessionId: string) => {
        if (!confirm('Are you sure you want to remove this device?')) return;
        try {
            await revokeSession(sessionId);
            // Refresh list
            setSessions(prev => prev.filter(s => s.id !== sessionId));
        } catch (err) {
            console.error(err);
            setError('Failed to revoke session');
        }
    };

    // --- Actions ---

    const handleUpdateProfile = async (e: React.FormEvent) => {
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

    const handleCreateDeviceInvite = async () => {
        setIsLoading(true);
        setError('');
        setInviteResult(null);
        try {
            const result = await createDeviceInvite();
            setInviteResult(result);
        } catch (err) {
            console.error(err);
            setError('Failed to create invite');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateUserInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUserName.trim()) return;
        
        setIsLoading(true);
        setError('');
        setInviteResult(null);
        try {
            const result = await createUserInvite(newUserName);
            setInviteResult(result);
            setNewUserName('');
        } catch (err) {
            console.error(err);
            setError('Failed to create user invite');
        } finally {
            setIsLoading(false);
        }
    };

    // --- Renderers ---



    return (
        <Modal
            isOpen={true} // Since the component is only rendered when open
            onClose={onClose}
            title="Settings"
            width="500px"
        >
            <div className="modal-tabs">
                <button 
                    className={`tab-button ${activeTab === 'general' ? 'active' : ''}`}
                    onClick={() => setActiveTab('general')}
                >
                    General
                </button>
                <button 
                    className={`tab-button ${activeTab === 'devices' ? 'active' : ''}`}
                    onClick={() => setActiveTab('devices')}
                >
                    Devices
                </button>
                {user?.is_admin && (
                    <button 
                        className={`tab-button ${activeTab === 'admin' ? 'active' : ''}`}
                        onClick={() => setActiveTab('admin')}
                    >
                        Admin
                    </button>
                )}
            </div>

            {error && <div className="error-message">{error}</div>}

            {/* GENERAL TAB */}
            {activeTab === 'general' && (
                <form onSubmit={handleUpdateProfile}>
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
                        <input
                            type="color"
                            value={profileColor}
                            onChange={(e) => setProfileColor(e.target.value)}
                            className="profile-color-picker"
                            aria-label="Select profile color"
                        />
                    </div>

                    <div className="modal-actions">
                        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
                        <button type="submit" disabled={isLoading} className="btn-primary">
                            {isLoading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            )}

            {/* DEVICES TAB */}
            {activeTab === 'devices' && (
                <div>
                    <div className="device-list">
                        {loadingSessions ? (
                            <p className="empty-state">Loading sessions...</p>
                        ) : sessions.length === 0 ? (
                            <p className="empty-state">No active sessions found.</p>
                        ) : (
                            sessions.map(session => (
                                <div key={session.id} className="device-item">
                                    <div className="device-info">
                                        <h4>
                                            {session.name}
                                            {/* We don't have current session ID easily unless we store it in context. 
                                                For now we can assume if it's NOT revoked it's valid. 
                                                Ideally we'd mark "This Device". */}
                                        </h4>
                                        <p>Last active: {new Date(session.last_used_at).toLocaleDateString()}</p>
                                    </div>
                                    {session.is_active && (
                                        <button 
                                            className="btn-revoke"
                                            onClick={() => handleRevokeSession(session.id)}
                                        >
                                            Revoke
                                        </button>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                    
                    <div className="admin-actions">
                        <button className="btn-secondary" onClick={handleCreateDeviceInvite} disabled={isLoading}>
                            Add New Device
                        </button>
                    </div>

                    {inviteResult && !inviteResult.user_id && (
                        <div className="invite-result">
                            <strong>New Device Code:</strong>
                            <div className="invite-code-display">{inviteResult.code}</div>
                            <div className="invite-expiry">
                                Expires at: {new Date(inviteResult.expires_at).toLocaleTimeString()}
                            </div>
                        </div>
                    )}
                    
                    <div className="modal-actions">
                        <button type="button" onClick={onClose} className="btn-secondary">Close</button>
                    </div>
                </div>
            )}

            {/* ADMIN TAB */}
            {activeTab === 'admin' && (
                <div className="admin-actions">
                    <h3>Create User Invite</h3>
                    <form onSubmit={handleCreateUserInvite}>
                        <div className="form-group">
                            <label>New User Name</label>
                            <input
                                type="text"
                                value={newUserName}
                                onChange={(e) => setNewUserName(e.target.value)}
                                required
                                className="input-field"
                                placeholder="e.g. Alice"
                            />
                        </div>
                        <button type="submit" className="btn-primary" disabled={isLoading}>
                            Generate Invite
                        </button>
                    </form>

                    {inviteResult && inviteResult.user_id && (
                        <div className="invite-result">
                            <strong>Invite Created for User!</strong>
                            <div className="invite-code-display">{inviteResult.code}</div>
                            <div className="invite-expiry">
                                Expires at: {new Date(inviteResult.expires_at).toLocaleString()}
                            </div>
                        </div>
                    )}
                    
                    <div className="modal-actions">
                        <button type="button" onClick={onClose} className="btn-secondary">Close</button>
                    </div>
                </div>
            )}
        </Modal>
    );
};

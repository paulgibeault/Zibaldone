import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './Login.css';

const Login: React.FC = () => {
    const [tokenInput, setTokenInput] = useState('');
    const [qrCode, setQrCode] = useState('');
    const [deviceName, setDeviceName] = useState('My Device');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    // In a real implementation, we would use a QR scanner lib here.
    // For now, we simulate "scanning" by pasting the invite code.
    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            // Assume we are hitting the /join endpoint directly
            // Note: We need to import the base URL or use the axios instance if we expose it
            // For simplicity, hardcoding for this MVP step or better, add join to api.ts
            const response = await axios.post('http://127.0.0.1:8000/api/auth/join', {
                code: qrCode,
                device_name: deviceName
            });

            const { token, user } = response.data;
            login(token, user);
            navigate('/');
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to join');
        } finally {
            setIsLoading(false);
        }
    };

    const handleManualToken = async (e: React.FormEvent) => {
        e.preventDefault();
        if (tokenInput) {
            setIsLoading(true);
            setError('');
            try {
                // Verify token against backend
                const response = await axios.get('http://127.0.0.1:8000/api/auth/me', {
                    headers: { 'Authorization': `Bearer ${tokenInput}` }
                });

                const user = response.data;
                login(tokenInput, user);
                navigate('/');
            } catch (err: any) {
                console.error("Token verification failed", err);
                setError('Invalid or expired token. Please check the server logs for the correct token.');
            } finally {
                setIsLoading(false);
            }
        }
    };

    return (
        <div className="login-container">
            <div className="login-header">
                <div className="app-logo login-logo-override" aria-label="Zibaldone Logo" />
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="login-options">
                {/* Option A: Join with Invite Code */}
                <div className="login-card">
                    <h3>Join with Invite Code</h3>
                    <form onSubmit={handleJoin}>
                        <div className="login-form-group">
                            <label>Device Name:</label>
                            <input
                                className="login-input"
                                type="text"
                                value={deviceName}
                                onChange={e => setDeviceName(e.target.value)}
                                required
                            />
                        </div>
                        <div className="login-form-group">
                            <label>Invite Code:</label>
                            <input
                                className="login-input"
                                type="text"
                                value={qrCode}
                                onChange={e => setQrCode(e.target.value)}
                                placeholder="Paste code here"
                                required
                            />
                        </div>
                        <button type="submit" className="login-button" disabled={isLoading}>
                            {isLoading ? 'Joining...' : 'Join Server'}
                        </button>
                    </form>
                </div>

                {/* Option B: Paste Existing Token */}
                <div className="login-card">
                    <h3>Paste Existing Token</h3>
                    <form onSubmit={handleManualToken}>
                        <div className="login-form-group">
                            <input
                                className="login-input"
                                type="text"
                                value={tokenInput}
                                onChange={e => setTokenInput(e.target.value)}
                                placeholder="Paste Bearer Token"
                            />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <button type="submit" className="login-button">Log In</button>
                            <p className="login-helper-text">Use the Admin Token printed in server logs.</p>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Login;

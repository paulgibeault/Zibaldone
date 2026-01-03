import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

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

    const handleManualToken = (e: React.FormEvent) => {
        e.preventDefault();
        // Self-note: This is a hacky backdoor for the Admin Bootstrap token
        // In a real app we might verify it against /users/me first
        if (tokenInput) {
            // Mock user for bootstrap token since we don't have a verify endpoint handy yet
            // Or better: call a "whoami" endpoint. For phase 3, let's just assume Admin.
            login(tokenInput, { id: 'bootstrap', display_name: 'Admin', is_admin: true });
            navigate('/');
        }
    };

    return (
        <div style={{ maxWidth: '400px', margin: '2rem auto', padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' }}>
            <h2>Login to Zibaldone</h2>

            {error && <div style={{ color: 'red', marginBottom: '1rem' }}>{error}</div>}

            <div style={{ marginBottom: '2rem' }}>
                <h3>Option A: Join with Invite Code</h3>
                <form onSubmit={handleJoin}>
                    <div style={{ marginBottom: '0.5rem' }}>
                        <label>Device Name:</label><br />
                        <input
                            type="text"
                            value={deviceName}
                            onChange={e => setDeviceName(e.target.value)}
                            required
                        />
                    </div>
                    <div style={{ marginBottom: '0.5rem' }}>
                        <label>Invite Code:</label><br />
                        <input
                            type="text"
                            value={qrCode}
                            onChange={e => setQrCode(e.target.value)}
                            placeholder="Paste code here"
                            required
                        />
                    </div>
                    <button type="submit" disabled={isLoading}>
                        {isLoading ? 'Joining...' : 'Join Server'}
                    </button>
                </form>
            </div>

            <div style={{ borderTop: '1px solid #eee', paddingTop: '1rem' }}>
                <h3>Option B: Paste Existing Token</h3>
                <form onSubmit={handleManualToken}>
                    <input
                        type="text"
                        value={tokenInput}
                        onChange={e => setTokenInput(e.target.value)}
                        placeholder="Paste Bearer Token"
                        style={{ width: '100%', marginBottom: '0.5rem' }}
                    />
                    <button type="submit">Log In</button>
                    <p style={{ fontSize: '0.8rem', color: '#666' }}>Use the Admin Token printed in server logs.</p>
                </form>
            </div>
        </div>
    );
};

export default Login;

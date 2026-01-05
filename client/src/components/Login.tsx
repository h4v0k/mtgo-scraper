import React, { useState } from 'react';
import './Login.css';

interface LoginProps {
    onLogin: (token: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        try {
            // Direct fetch to avoid circular dependency with api.ts if we put login there
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
            const response = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            if (response.ok) {
                const data = await response.json();
                onLogin(data.token);
            } else {
                const errData = await response.json();
                setError(errData.message || 'Login failed');
            }
        } catch (error) {
            setError('Connection refused');
        }
    };

    return (
        <div className="login-container">
            <div className="login-card card">
                <h2>Identify Yourself</h2>
                {error && <div className="error-msg">{error}</div>}
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Codename</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter username"
                        />
                    </div>
                    <div className="form-group">
                        <label>Passphrase</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter password"
                        />
                    </div>
                    <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                        Access Spyglass
                    </button>
                </form>
            </div>
        </div>
    );
};

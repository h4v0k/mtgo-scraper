
import { useState } from 'react';
import './AdminPanel.css';

export function AdminPanel() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [loading, setLoading] = useState(false);

    const generatePassword = () => {
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
        let pass = "";
        for (let i = 0; i < 16; i++) {
            pass += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setPassword(pass);
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setMsg(null);
        setLoading(true);

        try {
            const token = localStorage.getItem('spyglass_token');
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || 'Failed to create user');
            }

            setMsg({ type: 'success', text: `User ${data.username} created successfully!` });
            setUsername('');
            setPassword('');
        } catch (err) {
            setMsg({ type: 'error', text: (err as Error).message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="admin-panel">
            <h2>User Management</h2>
            <div className="admin-card">
                <h3>Add New User</h3>
                <form onSubmit={handleCreateUser}>
                    <div className="form-group">
                        <label>Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Password</label>
                        <div className="password-input-group">
                            <input
                                type="text"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            <button type="button" onClick={generatePassword} className="secondary-btn">
                                Generate
                            </button>
                        </div>
                    </div>
                    {msg && (
                        <div className={`message ${msg.type}`}>
                            {msg.text}
                        </div>
                    )}
                    <button type="submit" disabled={loading} className="primary-btn">
                        {loading ? 'Creating...' : 'Create User'}
                    </button>
                </form>
            </div>
        </div>
    );
}

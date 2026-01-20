import { useState, useEffect } from 'react';
import './AdminPanel.css';
import { LoginLogs } from './LoginLogs';

interface User {
    id: number;
    username: string;
    created_at?: string;
}

export function AdminPanel() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [loading, setLoading] = useState(false);
    const [users, setUsers] = useState<User[]>([]);
    const [activeTab, setActiveTab] = useState<'users' | 'logs'>('users');

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const token = localStorage.getItem('spyglass_token');
            const res = await fetch('/api/users', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            }
        } catch (err) {
            console.error("Failed to fetch users", err);
        }
    };

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
            fetchUsers(); // Refresh list
        } catch (err) {
            setMsg({ type: 'error', text: (err as Error).message });
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteUser = async (id: number) => {
        if (!confirm('Are you sure you want to delete this user?')) return;

        try {
            const token = localStorage.getItem('spyglass_token');
            const res = await fetch(`/api/users/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                fetchUsers();
            } else {
                alert('Failed to delete user');
            }
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="admin-panel">
            <h2>Admin Dashboard</h2>

            <div className="admin-tabs">
                <button
                    className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
                    onClick={() => setActiveTab('users')}
                >
                    Users
                </button>
                <button
                    className={`tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
                    onClick={() => setActiveTab('logs')}
                >
                    Login Logs
                </button>
            </div>

            {activeTab === 'logs' ? (
                <LoginLogs />
            ) : (
                <div className="admin-grid">
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

                    <div className="admin-card">
                        <h3>Existing Users</h3>
                        {users.length === 0 ? (
                            <p className="no-users">No other users found.</p>
                        ) : (
                            <ul className="user-list">
                                {users.map(u => (
                                    <li key={u.id} className="user-item">
                                        <span className="user-name">{u.username}</span>
                                        <button
                                            onClick={() => handleDeleteUser(u.id)}
                                            className="delete-btn"
                                            title="Delete User"
                                        >
                                            &times;
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

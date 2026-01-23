import { useState, useEffect } from 'react';
import './AdminPanel.css';
import { LoginLogs } from './LoginLogs';
import { ActivityLogs } from './ActivityLogs';
import { UsageStats } from './UsageStats';
import { VisitorLogs } from './VisitorLogs';
import { fetchUsers as apiFetchUsers } from '../../services/api';

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
    const [error, setError] = useState<string | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [activeTab, setActiveTab] = useState<'users' | 'logs' | 'activity' | 'stats' | 'visitors'>('users');

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            setError(null);
            const data = await apiFetchUsers();
            setUsers(data);
        } catch (err) {
            console.error("Failed to fetch users", err);
            setError('Unauthorized or session expired. Please log in again.');
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('spyglass_token');
        window.location.reload();
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
            <div className="admin-header">
                <h2>Admin Dashboard</h2>
                <button onClick={handleLogout} className="logout-btn">Logout</button>
            </div>

            {error && <div className="error-message">{error}</div>}

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
                <button
                    className={`tab-btn ${activeTab === 'activity' ? 'active' : ''}`}
                    onClick={() => setActiveTab('activity')}
                >
                    Activity Log
                </button>
                <button
                    className={`tab-btn ${activeTab === 'visitors' ? 'active' : ''}`}
                    onClick={() => setActiveTab('visitors')}
                >
                    Visitor Log
                </button>
                <button
                    className={`tab-btn ${activeTab === 'stats' ? 'active' : ''}`}
                    onClick={() => setActiveTab('stats')}
                >
                    Usage Stats
                </button>
            </div>

            {activeTab === 'logs' ? (
                <LoginLogs />
            ) : activeTab === 'activity' ? (
                <ActivityLogs />
            ) : activeTab === 'visitors' ? (
                <VisitorLogs />
            ) : activeTab === 'stats' ? (
                <UsageStats />
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

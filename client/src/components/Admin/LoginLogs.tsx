import { useEffect, useState } from 'react';
import type { LoginLog } from '../../services/api';
import { fetchLoginLogs } from '../../services/api';
import './AdminPanel.css'; // Reuse admin styles

export function LoginLogs() {
    const [logs, setLogs] = useState<LoginLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadLogs();
    }, []);

    const loadLogs = async () => {
        try {
            setLoading(true);
            const data = await fetchLoginLogs();
            setLogs(data);
        } catch (err) {
            setError('Failed to load logs');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="loading-state">Loading logs...</div>;
    if (error) return <div className="error-message">{error}</div>;

    return (
        <div className="admin-logs">
            <div className="logs-header">
                <h3>Recent Login Activity</h3>
                <button onClick={loadLogs} className="secondary-btn">Refresh</button>
            </div>

            <div className="table-container">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>User</th>
                            <th>IP Address</th>
                            <th>User Agent</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.map(log => (
                            <tr key={log.id}>
                                <td>{new Date(log.login_timestamp).toLocaleString()}</td>
                                <td className="user-cell">{log.username}</td>
                                <td className="mono-cell">{log.ip_address}</td>
                                <td className="userAgent-cell" title={log.user_agent}>
                                    {log.user_agent.length > 50
                                        ? log.user_agent.substring(0, 50) + '...'
                                        : log.user_agent}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

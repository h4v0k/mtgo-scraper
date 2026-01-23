import { useEffect, useState } from 'react';
import { fetchPublicActivityLogs } from '../../services/api';
import './AdminPanel.css';

export function ActivityLogs() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadLogs();
    }, []);

    const loadLogs = async () => {
        try {
            setLoading(true);
            const data = await fetchPublicActivityLogs();
            setLogs(data);
        } catch (err) {
            setError('Failed to load activity logs');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="loading-state">Loading activity logs...</div>;
    if (error) return <div className="error-message">{error}</div>;

    return (
        <div className="admin-logs">
            <div className="logs-header">
                <h3>Public Activity Log (IP/UA Tracking)</h3>
                <button onClick={loadLogs} className="secondary-btn">Refresh</button>
            </div>

            <div className="table-container">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>Time (EST)</th>
                            <th>Endpoint</th>
                            <th>IP Address</th>
                            <th>User Agent</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.map(log => (
                            <tr key={log.id}>
                                <td>{new Date(log.timestamp).toLocaleString('en-US', { timeZone: 'America/New_York' })}</td>
                                <td className="endpoint-cell">{log.endpoint}</td>
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

import { useEffect, useState } from 'react';
import { fetchVisitors } from '../../services/api';
import './AdminPanel.css';

export function VisitorLogs() {
    const [visitors, setVisitors] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadLogs();
    }, []);

    const loadLogs = async () => {
        try {
            setLoading(true);
            const data = await fetchVisitors();
            setVisitors(data);
        } catch (err) {
            setError('Failed to load visitor summary');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="loading-state">Loading visitor summary...</div>;
    if (error) return <div className="error-message">{error}</div>;

    return (
        <div className="admin-logs">
            <div className="logs-header">
                <h3>Unique Visitors (IP Grouped)</h3>
                <button onClick={loadLogs} className="secondary-btn">Refresh</button>
            </div>

            <div className="table-container">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>Last Seen (EST)</th>
                            <th>IP Address</th>
                            <th>Total Hits</th>
                            <th>User Agent</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visitors.map((v, i) => (
                            <tr key={i}>
                                <td>{new Date(v.last_seen).toLocaleString('en-US', { timeZone: 'America/New_York' })}</td>
                                <td className="mono-cell">{v.ip_address}</td>
                                <td style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>{v.total_hits}</td>
                                <td className="userAgent-cell" title={v.user_agent}>
                                    {v.user_agent.length > 50
                                        ? v.user_agent.substring(0, 50) + '...'
                                        : v.user_agent}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

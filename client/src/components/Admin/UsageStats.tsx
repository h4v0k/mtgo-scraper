import { useEffect, useState } from 'react';
import { fetchUsageStats } from '../../services/api';
import './AdminPanel.css';

export function UsageStats() {
    const [stats, setStats] = useState<{ daily: any[], endpoints: any[] } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            setLoading(true);
            const data = await fetchUsageStats();
            setStats(data);
        } catch (err) {
            setError('Failed to load usage stats');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="loading-state">Loading usage stats...</div>;
    if (error) return <div className="error-message">{error}</div>;
    if (!stats) return null;

    return (
        <div className="usage-stats">
            <div className="stats-header">
                <h3>Usage Statistics</h3>
                <button onClick={loadStats} className="secondary-btn">Refresh</button>
            </div>

            <div className="stats-grid">
                <div className="admin-card">
                    <h4>Daily Activity (Last 30 Days)</h4>
                    <div className="table-container">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Day</th>
                                    <th>Unique Visitors (IPs)</th>
                                    <th>Total Requests</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.daily.map((d, i) => (
                                    <tr key={i}>
                                        <td className="mono-cell">{d.day}</td>
                                        <td>{d.unique_ips}</td>
                                        <td>{d.total_requests}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="admin-card">
                    <h4>Top Public Endpoints</h4>
                    <div className="table-container">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Endpoint</th>
                                    <th>Hits</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.endpoints.map((e, i) => (
                                    <tr key={i}>
                                        <td className="endpoint-cell">{e.endpoint}</td>
                                        <td>{e.count}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

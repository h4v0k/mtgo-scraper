import { useState, useEffect } from 'react';

export function HealthCheck() {
    const [status, setStatus] = useState<any>(null);
    const [error, setError] = useState('');

    const check = async () => {
        try {
            const isLocal = window.location.hostname === 'localhost';
            const API_URL = import.meta.env.VITE_API_URL || (isLocal ? 'http://localhost:3001/api' : '/api');

            const res = await fetch(`${API_URL}/debug`);
            const text = await res.text();
            try {
                setStatus(JSON.parse(text));
            } catch {
                setStatus(text);
            }
        } catch (e: any) {
            setError(e.message);
        }
    };

    useEffect(() => { check(); }, []);

    return (
        <div style={{ padding: 20, background: '#333', color: 'white', position: 'fixed', bottom: 0, right: 0, zIndex: 9999, maxWidth: 400 }}>
            <h3>System Status</h3>
            <button onClick={check}>Refresh</button>
            {error && <div style={{ color: 'red' }}>Error: {error}</div>}
            {status && <pre style={{ overflow: 'auto' }}>{JSON.stringify(status, null, 2)}</pre>}
        </div>
    );
}

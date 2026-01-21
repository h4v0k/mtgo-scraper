
import { useState } from 'react';
import './Gameplay.css';
import { fetchPlayerHistory } from '../../services/api';

interface PlayerDeck {
    id: number;
    event_date: string;
    event_name: string;
    format: string;
    rank: number;
    archetype: string;
}

export function Gameplay() {
    const [playerName, setPlayerName] = useState('');
    const [history, setHistory] = useState<PlayerDeck[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchedName, setSearchedName] = useState('');
    const [error, setError] = useState('');

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!playerName.trim()) return;

        setLoading(true);
        setError('');
        setSearchedName(playerName);
        setHistory([]);

        try {
            const data = await fetchPlayerHistory(playerName);
            setHistory(data);
        } catch (err) {
            setError('Failed to fetch player history. Please try again.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="gameplay-container">
            <div className="gameplay-header">
                <h2>Gameplay Intelligence</h2>
                <p className="subtitle">Opponent Reconnaissance & Player History</p>
            </div>

            <div className="search-section">
                <form onSubmit={handleSearch} className="player-search-form">
                    <input
                        type="text"
                        placeholder="Enter MTGO Player Name..."
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                        className="player-input"
                    />
                    <button type="submit" className="search-btn" disabled={loading}>
                        {loading ? 'Scanning...' : 'Analyze Player'}
                    </button>
                </form>
            </div>

            {searchedName && !loading && (
                <div className="results-section">
                    <h3>History for "{searchedName}" (Last 30 Days)</h3>

                    {history.length === 0 ? (
                        <div className="no-data">No recent events found for this player.</div>
                    ) : (
                        <div className="history-grid">
                            {history.map((deck) => (
                                <div key={deck.id} className="history-card">
                                    <div className="card-header">
                                        <span className="event-date">{new Date(deck.event_date).toLocaleDateString()}</span>
                                        <span className={`rank-badge rank-${deck.rank <= 8 ? 'top8' : 'other'}`}>
                                            #{deck.rank}
                                        </span>
                                    </div>
                                    <div className="deck-info">
                                        <span className="format-tag">{deck.format}</span>
                                        <h4>{deck.archetype}</h4>
                                        <div className="event-name">{deck.event_name}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

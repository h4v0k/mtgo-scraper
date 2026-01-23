import { useState, useEffect, useRef } from 'react';
import './Gameplay.css';
import { fetchPlayerHistory, fetchGoldfishHistory, searchPlayers, syncPlayer } from '../../services/api';
import { DeckView } from '../Dashboard/DeckView';

interface PlayerDeck {
    id: number;
    event_date: string;
    event_name: string;
    format: string;
    rank: number;
    archetype: string;
    // New fields for external data
    source?: 'local' | 'mtggoldfish';
    url?: string; // External link
    cards?: any[]; // optional presence check
    spice_count?: number;
}

export function Gameplay({ initialPlayerName }: { initialPlayerName?: string }) {
    const [playerName, setPlayerName] = useState(initialPlayerName || '');

    useEffect(() => {
        if (initialPlayerName) {
            setPlayerName(initialPlayerName);
            performSearch(initialPlayerName, 30);
        }
    }, [initialPlayerName]);
    const [history, setHistory] = useState<PlayerDeck[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchedName, setSearchedName] = useState('');
    const [error, setError] = useState('');
    const [viewDeckId, setViewDeckId] = useState<number | null>(null);

    // Suggestion state
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Debounced search effect
    useEffect(() => {
        const timeoutId = setTimeout(async () => {
            if (playerName.length >= 2) {
                try {
                    const results = await searchPlayers(playerName);
                    setSuggestions(results);
                    setShowSuggestions(true);
                } catch (e) {
                    console.error(e);
                }
            } else {
                setSuggestions([]);
                setShowSuggestions(false);
            }
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [playerName]);

    // Click outside to close
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);


    const [days, setDays] = useState(30);

    // State for polling
    const [isPolling, setIsPolling] = useState(false);

    // FIX: League display check - ensure case insensitivity covers all variants
    const isLeague = (eventName: string) => /league/i.test(eventName);

    const performSearch = async (name: string, lookbackDays: number) => {
        if (!name.trim()) return;

        setShowSuggestions(false);
        setLoading(true);
        setError('');
        setSearchedName(name);
        setHistory([]);
        setViewDeckId(null);
        setIsPolling(false); // Reset polling trigger

        try {
            // Initial Fetch
            await fetchAndSetHistory(name, lookbackDays);

            // Trigger background sync
            syncPlayer(name, lookbackDays)
                .then(() => {
                    // Start Polling after sync init
                    setIsPolling(true);
                })
                .catch(err => console.error("Sync trigger failed", err));

        } catch (err) {
            setError('An error occurred while fetching player history.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Helper to fetch and merge
    const fetchAndSetHistory = async (name: string, lookbackDays: number) => {
        const [localData, externalData] = await Promise.all([
            fetchPlayerHistory(name, lookbackDays).catch(() => []),
            fetchGoldfishHistory(name, lookbackDays).catch(() => [])
        ]);

        const localTagged = localData.map((d: any) => ({ ...d, source: 'local' }));
        const externalTagged = externalData.map((d: any) => ({ ...d, source: 'mtggoldfish' }));

        const merged = [...localTagged];

        // Improve Deduplication: 
        // 1. Primary Key: Date + Normalized Event Name
        // 2. Secondary Key: Date + Format + Rank (Strong signal for Top 8/Challenges)

        const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');

        const localKeys = new Set(localTagged.map((d: any) => {
            const dateStr = d.event_date.split('T')[0];
            return `${dateStr}|${normalize(d.event_name)}`;
        }));

        const localSecondaryKeys = new Set(localTagged.map((d: any) => {
            const dateStr = d.event_date.split('T')[0];
            // Only use secondary key if we have a valid rank (Top N or 5-0)
            if (d.rank && d.rank > 0) {
                return `${dateStr}|${d.format.toLowerCase()}|${d.rank}`;
            }
            return null;
        }).filter(Boolean));

        externalTagged.forEach((d: any) => {
            const dateStr = d.event_date.split('T')[0];
            const nameKey = `${dateStr}|${normalize(d.event_name)}`;
            const rankKey = (d.rank && d.rank > 0) ? `${dateStr}|${d.format.toLowerCase()}|${d.rank}` : null;

            // Check both keys
            const existsByName = localKeys.has(nameKey);
            const existsByRank = rankKey ? localSecondaryKeys.has(rankKey) : false;

            if (!existsByName && !existsByRank) {
                merged.push(d);
            }
        });

        merged.sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());
        setHistory(merged);
        return merged;
    };

    // Polling Effect
    useEffect(() => {
        let intervalId: any;
        let attempts = 0;
        const MAX_ATTEMPTS = 5; // Poll for 15 seconds

        if (isPolling && searchedName) {
            intervalId = setInterval(async () => {
                attempts++;
                if (attempts > MAX_ATTEMPTS) {
                    setIsPolling(false);
                    return;
                }
                // Silent update
                await fetchAndSetHistory(searchedName, days);
            }, 3000); // Every 3 seconds
        }

        return () => clearInterval(intervalId);
    }, [isPolling, searchedName, days]);

    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        await performSearch(playerName, days);
    };

    if (viewDeckId) {
        return <DeckView
            deckId={viewDeckId}
            onBack={() => setViewDeckId(null)}
            onPlayerSearch={(name) => performSearch(name, days)}
        />;
    }

    return (
        <div className="gameplay-container">
            <div className="gameplay-header">
                <h2>Player Lookup</h2>
                <p className="subtitle">Opponent Reconnaissance & Player History</p>
            </div>

            <div className="search-section">
                <form onSubmit={handleSearch} className="player-search-form">
                    <div className="input-group">
                        <div className="input-wrapper" ref={wrapperRef}>
                            <input
                                type="text"
                                placeholder="Enter MTGO Player Name..."
                                value={playerName}
                                onChange={(e) => setPlayerName(e.target.value)}
                                onFocus={() => {
                                    if (suggestions.length > 0) setShowSuggestions(true);
                                }}
                                className="player-input"
                            />
                            {showSuggestions && suggestions.length > 0 && (
                                <div className="suggestions-dropdown">
                                    {suggestions.map((name) => (
                                        <div
                                            key={name}
                                            className="suggestion-item"
                                            onClick={() => {
                                                setPlayerName(name);
                                                performSearch(name, days);
                                            }}
                                        >
                                            {name}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="days-selector">
                            {[30, 60, 90].map((d) => (
                                <button
                                    key={d}
                                    type="button"
                                    className={`days-btn ${days === d ? 'active' : ''}`}
                                    onClick={() => setDays(d)}
                                >
                                    {d}d
                                </button>
                            ))}
                        </div>
                    </div>
                    <button type="submit" className="search-btn" disabled={loading}>
                        {loading ? '...' : 'Search'}
                    </button>
                </form>
            </div>

            {error && <div className="error-message">{error}</div>}

            {searchedName && !loading && (
                <div className="results-section">
                    <h3>History for "{searchedName}" (Last {days} Days)</h3>

                    {history.length === 0 ? (
                        <div className="no-data">No recent events found for this player.</div>
                    ) : (
                        <div className="history-grid">
                            {history.map((deck) => (
                                <div
                                    key={deck.id}
                                    className={`history-card clickable ${deck.source === 'mtggoldfish' ? 'external-source' : ''}`}
                                    onClick={() => {
                                        if (deck.source === 'mtggoldfish' && deck.url) {
                                            window.open(deck.url, '_blank');
                                        } else {
                                            setViewDeckId(deck.id);
                                        }
                                    }}
                                    title={deck.source === 'mtggoldfish' ? 'View on MTGGoldfish' : 'View Deck Details'}
                                >
                                    <div className="card-header">
                                        <span className="event-date">{new Date(deck.event_date).toLocaleDateString()}</span>
                                        <span className={`rank-badge ${isLeague(deck.event_name) ? 'rank-league' :
                                            deck.rank <= 8 ? 'rank-top8' : 'rank-swiss'
                                            } ${deck.source === 'mtggoldfish' ? 'rank-external' : ''}`}>
                                            {isLeague(deck.event_name) ? '5-0' : `#${deck.rank}`}
                                        </span>
                                    </div>
                                    <div className="deck-info">
                                        <div className="deck-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span className="format-tag">
                                                {deck.format}
                                                {deck.source === 'mtggoldfish' && <span className="source-tag"> (Ext)</span>}
                                            </span>
                                            {deck.spice_count !== undefined && deck.spice_count > 0 && (
                                                <span className="spice-badge" style={{
                                                    backgroundColor: '#ff4d4d',
                                                    color: 'white',
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    fontSize: '0.7em',
                                                    fontWeight: 'bold',
                                                    marginLeft: '8px',
                                                    boxShadow: '0 0 5px rgba(255, 77, 77, 0.5)'
                                                }}>
                                                    🌶️ {deck.spice_count}
                                                </span>
                                            )}
                                        </div>
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

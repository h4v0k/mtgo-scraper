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

    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [isFocused, setIsFocused] = useState(false);

    // Debounced search effect
    useEffect(() => {
        const timeoutId = setTimeout(async () => {
            if (playerName.length >= 2 && isFocused) {
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
    }, [playerName, isFocused]);

    // Click outside to close
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
                setIsFocused(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);


    const [days, setDays] = useState(30);

    // State for polling
    const [isPolling, setIsPolling] = useState(false);

    // FIX: League display check - ensure case insensitivity covers all variants
    const isLeague = (eventName: string, rank?: number) =>
        rank === 0 || (eventName && /league/i.test(eventName));

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
            console.log(`[PLAYER SEARCH] Fetching history for ${name}...`);
            await fetchAndSetHistory(name, lookbackDays);

            // Trigger background sync
            console.log(`[PLAYER SEARCH] Triggering sync for ${name}...`);
            syncPlayer(name, lookbackDays)
                .then(() => {
                    console.log(`[PLAYER SEARCH] Sync triggered successfully, starting polling...`);
                    // Start Polling after sync init
                    setIsPolling(true);
                })
                .catch(err => {
                    console.error("[PLAYER SEARCH] Sync trigger failed:", err);
                });

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

        // Robust Deduplication using source_url
        // 1. Map local decks by their source_url for O(1) lookup
        const localSourceUrls = new Set(localTagged.map((d: any) => d.source_url).filter(Boolean));

        // 2. Fallback keys for legacy data or edge cases
        const normalize = (str: string) => str ? str.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
        const localNameKeys = new Set(localTagged.map((d: any) => {
            const dateStr = d.event_date.split('T')[0];
            return `${dateStr}|${normalize(d.event_name)}`;
        }));

        externalTagged.forEach((d: any) => {
            // Check by URL first (Strongest)
            if (d.url && localSourceUrls.has(d.url)) return;

            // Check by Name/Date (Fallback)
            const dateStr = d.event_date.split('T')[0];
            const nameKey = `${dateStr}|${normalize(d.event_name)}`;
            if (localNameKeys.has(nameKey)) return;

            merged.push(d);
        });

        merged.sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());
        setHistory(merged);
        return merged;
    };

    // Polling Effect
    useEffect(() => {
        let intervalId: any;
        let attempts = 0;
        const MAX_ATTEMPTS = 60; // Poll for up to 3 minutes (60 × 3s = 180s)

        if (isPolling && searchedName) {
            console.log(`[POLLING] Starting polling for ${searchedName}...`);
            intervalId = setInterval(async () => {
                attempts++;
                console.log(`[POLLING] Attempt ${attempts}/${MAX_ATTEMPTS} for ${searchedName}`);
                if (attempts > MAX_ATTEMPTS) {
                    console.log(`[POLLING] Max attempts reached, stopping polling`);
                    setIsPolling(false);
                    return;
                }
                // Silent update
                await fetchAndSetHistory(searchedName, days);
            }, 3000); // Every 3 seconds
        }

        return () => {
            if (intervalId) {
                console.log(`[POLLING] Cleanup - clearing interval`);
                clearInterval(intervalId);
            }
        };
    }, [isPolling, searchedName, days]);

    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setIsFocused(false);
        setShowSuggestions(false);
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
                                onFocus={() => setIsFocused(true)}
                                className="player-input"
                            />
                            {showSuggestions && suggestions.length > 0 && isFocused && (
                                <div className="suggestions-dropdown">
                                    {suggestions.map((name) => (
                                        <div
                                            key={name}
                                            className="suggestion-item"
                                            onClick={() => {
                                                setPlayerName(name);
                                                setShowSuggestions(false);
                                                setIsFocused(false);
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
                        {loading ? 'Searching...' : 'Search'}
                    </button>
                </form>
            </div>

            {error && <div className="error-message">{error}</div>}

            {searchedName && !loading && (
                <div className="results-section">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3>History for "{searchedName}" (Last {days} Days)</h3>
                    </div>

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
                                        <span className={`rank-badge ${isLeague(deck.event_name, deck.rank) ? 'rank-league' :
                                            deck.rank <= 8 ? 'rank-top8' : 'rank-swiss'
                                            } ${deck.source === 'mtggoldfish' ? 'rank-external' : ''}`}>
                                            {isLeague(deck.event_name, deck.rank) ? '5-0' : `#${deck.rank}`}
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

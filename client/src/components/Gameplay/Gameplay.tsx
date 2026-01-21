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
}

export function Gameplay() {
    const [playerName, setPlayerName] = useState('');
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

    const performSearch = async (name: string, lookbackDays: number) => {
        if (!name.trim()) return;

        setShowSuggestions(false); // Close suggestions on search
        setLoading(true);
        setError('');
        setSearchedName(name);
        setHistory([]);
        setViewDeckId(null);

        try {
            // Run both fetches in parallel
            const [localData, externalData] = await Promise.all([
                fetchPlayerHistory(name, lookbackDays).catch(e => {
                    console.error("Local fetch failed", e);
                    return [];
                }),
                fetchGoldfishHistory(name, lookbackDays).catch(e => {
                    console.error("Goldfish fetch failed", e);
                    return [];
                })
            ]);

            // Mark sources
            const localTagged = localData.map((d: any) => ({ ...d, source: 'local' }));
            const externalTagged = externalData.map((d: any) => ({ ...d, source: 'mtggoldfish' }));

            // Merge and Deduplicate
            const merged = [...localTagged];
            const localKeys = new Set(localTagged.map((d: any) => `${d.event_date.split('T')[0]}|${d.event_name}`));

            externalTagged.forEach((d: any) => {
                const key = `${d.event_date}|${d.event_name}`;
                if (!localKeys.has(key)) {
                    merged.push(d);
                }
            });

            // Sort by Date DESC
            merged.sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());

            setHistory(merged);

            // Trigger background sync to import missing decks
            // We do this after setting history so UI updates first
            syncPlayer(name, lookbackDays).catch(err => console.error("Sync trigger failed", err));

        } catch (err) {
            setError('An error occurred while fetching player history.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        await performSearch(playerName, days);
    };

    if (viewDeckId) {
        return <DeckView deckId={viewDeckId} onBack={() => setViewDeckId(null)} />;
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
                    <h3>History for "{searchedName}" (Last 30 Days)</h3>

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
                                        <span className={`rank-badge rank-${(deck.rank <= 8 || deck.event_name.toLowerCase().includes('league')) ? 'top8' : 'other'}`}>
                                            {deck.event_name.toLowerCase().includes('league') ? '5-0' : `#${deck.rank}`}
                                        </span>
                                    </div>
                                    <div className="deck-info">
                                        <span className="format-tag">
                                            {deck.format}
                                            {deck.source === 'mtggoldfish' && <span className="source-tag"> (Ext)</span>}
                                        </span>
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

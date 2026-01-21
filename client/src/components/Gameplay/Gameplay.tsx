import { useState, useEffect, useRef } from 'react';
import './Gameplay.css';
import { fetchPlayerHistory, fetchGoldfishHistory, searchPlayers } from '../../services/api';
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


    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!playerName.trim()) return;

        setShowSuggestions(false); // Close suggestions on search

        setLoading(true);
        setError('');
        setSearchedName(playerName);
        setHistory([]);
        setViewDeckId(null);

        try {
            // Run both fetches in parallel
            const [localData, externalData] = await Promise.all([
                fetchPlayerHistory(playerName).catch(e => {
                    console.error("Local fetch failed", e);
                    return [];
                }),
                fetchGoldfishHistory(playerName).catch(e => {
                    console.error("Goldfish fetch failed", e);
                    return [];
                })
            ]);

            // Mark sources
            const localTagged = localData.map((d: any) => ({ ...d, source: 'local' }));
            const externalTagged = externalData.map((d: any) => ({ ...d, source: 'mtggoldfish' }));

            // Merge and Deduplicate
            // Strategy: Create a map by "Date + Event". If local exists, use it (it has cards). 
            // If external exists and we don't have local, add it.
            // Note: Date strings might differ slightly or be same. Goldfish is YYYY-MM-DD. Local is ISO or similar.
            // Let's normalize date to YYYY-MM-DD for comparison.

            const merged = [...localTagged];
            const localKeys = new Set(localTagged.map((d: any) => `${d.event_date.split('T')[0]}|${d.event_name}`));

            externalTagged.forEach((d: any) => {
                const key = `${d.event_date}|${d.event_name}`;
                // Only add if we don't have a local match for this event
                // Loose matching on event name? "Modern Challenge 32..."
                // For now, strict match or just append all and let user decide?
                // Append all is safer to not hide data, but might show duplicates. 
                // Let's simple filter checking if we have exact match.
                // Actually, Goldfish names might be slightly different.
                // Let's just append them and sort by date. 
                // Visual dupes are better than missing data.

                // Let's try to filter if key exists to avoid exact dupes
                if (!localKeys.has(key)) {
                    merged.push(d);
                }
            });

            // Sort by Date DESC
            merged.sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());

            setHistory(merged);
        } catch (err) {
            setError('An error occurred while fetching player history.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (viewDeckId) {
        return <DeckView deckId={viewDeckId} onBack={() => setViewDeckId(null)} />;
    }

    return (
        <div className="gameplay-container">
            <div className="gameplay-header">
                <h2>Gameplay Intelligence</h2>
                <p className="subtitle">Opponent Reconnaissance & Player History</p>
            </div>

            <div className="search-section">
                <form onSubmit={handleSearch} className="player-search-form">
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
                                            setShowSuggestions(false);
                                            // Optional: auto-trigger search?
                                            // Let's just fill it for now so they can hit enter or click button
                                        }}
                                    >
                                        {name}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <button type="submit" className="search-btn" disabled={loading}>
                        {loading ? 'Scanning...' : 'Analyze Player'}
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
                                        <span className={`rank-badge rank-${deck.rank <= 8 ? 'top8' : 'other'}`}>
                                            #{deck.rank}
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

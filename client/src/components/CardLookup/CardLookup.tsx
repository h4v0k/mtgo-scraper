import { useState, useEffect, useRef } from 'react';
import './CardLookup.css';
import { searchCardNames, fetchDecksByCard } from '../../services/api';
import type { CardLookupResult } from '../../services/api';
import { DeckView } from '../Dashboard/DeckView';

export function CardLookup() {
    const [cardName, setCardName] = useState('');
    const [format, setFormat] = useState('Standard');
    const [days, setDays] = useState('30');
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<CardLookupResult[]>([]);
    const [scryfallImage, setScryfallImage] = useState<string | null>(null);
    const [viewDeckId, setViewDeckId] = useState<number | null>(null);
    const [searchedCard, setSearchedCard] = useState('');

    const wrapperRef = useRef<HTMLDivElement>(null);

    const [isFocused, setIsFocused] = useState(false);

    // Debounced search for suggestions
    useEffect(() => {
        const timeoutId = setTimeout(async () => {
            if (cardName.length >= 2 && isFocused) {
                const names = await searchCardNames(cardName, format);
                setSuggestions(names);
                setShowSuggestions(true);
            } else {
                setSuggestions([]);
                setShowSuggestions(false);
            }
        }, 300);
        return () => clearTimeout(timeoutId);
    }, [cardName, format, isFocused]);

    // Click outside handler
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
                setIsFocused(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSearch = async (nameToSearch: string = cardName) => {
        if (!nameToSearch) return;
        setLoading(true);
        setSearchedCard(nameToSearch);
        setShowSuggestions(false);
        setIsFocused(false);
        setScryfallImage(null);

        try {
            // Fetch Scryfall Image
            fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(nameToSearch)}`)
                .then(res => res.json())
                .then(data => {
                    if (data.image_uris) {
                        setScryfallImage(data.image_uris.normal || data.image_uris.art_crop);
                    } else if (data.card_faces && data.card_faces[0].image_uris) {
                        setScryfallImage(data.card_faces[0].image_uris.normal);
                    }
                })
                .catch(err => console.error("Scryfall error:", err));

            const data = await fetchDecksByCard(nameToSearch, format, days);
            setResults(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (viewDeckId) {
        return (
            <DeckView
                deckId={viewDeckId}
                onBack={() => setViewDeckId(null)}
                onPlayerSearch={() => { }} // Could be implemented to switch tabs, but keeping simple for now
            />
        );
    }

    return (
        <div className="card-lookup-container">
            <div className="lookup-header">
                <h2>Card Lookup</h2>
                <p className="subtitle">Track card performance and presence across the meta</p>
            </div>

            <div className="lookup-controls" ref={wrapperRef}>
                <div className="search-box-group">
                    <div className="input-wrapper">
                        <input
                            type="text"
                            value={cardName}
                            onChange={(e) => setCardName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            onFocus={() => setIsFocused(true)}
                            placeholder="Search for a card..."
                            className="card-input"
                        />
                        {showSuggestions && suggestions.length > 0 && isFocused && (
                            <div className="suggestions-dropdown">
                                {suggestions.map((s, idx) => (
                                    <div
                                        key={idx}
                                        className="suggestion-item"
                                        onClick={() => {
                                            setCardName(s);
                                            setShowSuggestions(false);
                                            setIsFocused(false);
                                            handleSearch(s);
                                        }}
                                    >
                                        {s}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="filters-group">
                    <select value={format} onChange={(e) => setFormat(e.target.value)} className="lookup-select">
                        <option value="Standard">Standard</option>
                        <option value="Modern">Modern</option>
                        <option value="Pioneer">Pioneer</option>
                        <option value="Legacy">Legacy</option>
                        <option value="Pauper">Pauper</option>
                    </select>

                    <div className="days-selector">
                        {['7', '30', '60', '90', 'all'].map(d => (
                            <button
                                key={d}
                                className={`days-btn ${days === d ? 'active' : ''}`}
                                onClick={() => setDays(d)}
                            >
                                {d === 'all' ? 'All' : `${d}d`}
                            </button>
                        ))}
                    </div>

                    <button className="lookup-search-btn" onClick={() => handleSearch()} disabled={loading}>
                        {loading ? 'Searching...' : 'Search'}
                    </button>
                </div>
            </div>

            <div className="lookup-layout">
                <div className="lookup-results">
                    {searchedCard && (
                        <div className="results-header">
                            <h3>Decks containing "{searchedCard}"</h3>
                            <span className="results-count">{results.length} results found</span>
                        </div>
                    )}

                    {loading ? (
                        <div className="loading-state">Consulting the Archives...</div>
                    ) : results.length > 0 ? (
                        <div className="lookup-table-wrapper">
                            <table className="lookup-table">
                                <thead>
                                    <tr>
                                        <th>Player</th>
                                        <th>Event</th>
                                        <th>Date</th>
                                        <th>Format</th>
                                        <th>Archetype</th>
                                        <th>Place</th>
                                        <th>Qty</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {results.map((r) => (
                                        <tr
                                            key={r.id}
                                            className={`lookup-row ${r.spice_count > 3 ? 'spicy' : ''}`}
                                            onClick={() => setViewDeckId(r.id)}
                                        >
                                            <td className="player-cell">{r.player_name}</td>
                                            <td className="event-cell">{r.event_name}</td>
                                            <td className="date-cell">{new Date(r.event_date).toLocaleDateString()}</td>
                                            <td><span className="format-badge">{r.format}</span></td>
                                            <td className="archetype-cell">{r.archetype}</td>
                                            <td>
                                                <span className={`rank-badge ${r.rank <= 8 ? 'top8' : 'other'}`}>
                                                    {r.rank || '-'}
                                                </span>
                                            </td>
                                            <td className="qty-cell">
                                                <span className="qty-count">{r.card_count}x</span>
                                                {r.spice_count > 3 && <span className="spice-tag">✦ SPICE</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : searchedCard ? (
                        <div className="no-results">No decks found containing this card in the selected period.</div>
                    ) : (
                        <div className="lookup-placeholder">Enter a card name above to start your search.</div>
                    )}
                </div>

                {scryfallImage && (
                    <div className="card-preview-panel">
                        <div className="card-image-container">
                            <img src={scryfallImage} alt={searchedCard} className="card-image" />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

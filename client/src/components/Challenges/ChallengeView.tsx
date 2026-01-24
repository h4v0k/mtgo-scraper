import React, { useEffect, useState } from 'react';
import { fetchChallengeResults } from '../../services/api';
import type { ChallengeResult, DeckDetail } from '../../services/api';
import { DeckView } from '../Dashboard/DeckView';
import './ChallengeView.css';

export const ChallengeView: React.FC = () => {
    const [format, setFormat] = useState('Standard');
    const [date, setDate] = useState<string>('');
    const [data, setData] = useState<ChallengeResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [selectedDeckId, setSelectedDeckId] = useState<number | null>(null);

    useEffect(() => {
        setLoading(true);
        fetchChallengeResults(format, date)
            .then(res => {
                setData(res);
                if (res.date) setDate(res.date); // Update date if we fetched latest
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [format, date]); // If date is empty, API finds latest.

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setDate(e.target.value);
    };

    if (selectedDeckId !== null) {
        return (
            <DeckView
                deckId={selectedDeckId}
                onBack={() => setSelectedDeckId(null)}
                onPlayerSearch={(name) => console.log("Player search from challenge not implemented yet", name)}
            />
        );
    }

    return (
        <div className="challenge-view">
            <div className="challenge-controls">
                <select value={format} onChange={(e) => setFormat(e.target.value)} className="format-select">
                    <option value="Standard">Standard</option>
                    <option value="Pioneer">Pioneer</option>
                    <option value="Modern">Modern</option>
                    <option value="Legacy">Legacy</option>
                    <option value="Vintage">Vintage</option>
                    <option value="Pauper">Pauper</option>
                </select>
                <input
                    type="date"
                    value={date}
                    onChange={handleDateChange}
                    className="date-select"
                    max={new Date().toISOString().split('T')[0]}
                />
            </div>

            {loading ? (
                <div className="loading-state">Fetching Challenge Results...</div>
            ) : !data || !data.events || data.events.length === 0 ? (
                <div className="empty-state">No challenge results found for this date.</div>
            ) : (
                <div className="results-container">
                    <h2 className="results-header">Top 4 - {data.date} ({format})</h2>

                    {data.events.map((event, idx) => (
                        <div key={idx} className="event-section" style={{ marginBottom: '3rem' }}>
                            <h3 className="event-subheader" style={{ color: '#88aaff', borderBottom: '1px solid #444', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>
                                {event.event_name}
                            </h3>
                            <div className="top-decks-grid">
                                {event.decks.map((deck) => (
                                    <DeckCardGrid key={deck.id} deck={deck} onView={() => setSelectedDeckId(deck.id)} />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const DeckCardGrid: React.FC<{ deck: DeckDetail; onView: () => void }> = ({ deck, onView }) => {
    // We want to show a nice grid of cards. 
    // Logic: Take unique non-land cards from main and side
    const nonLands = (deck.cards || []).concat(deck.sideboard || [])
        .filter(c => !['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'].includes(c.name))

    // Limit to top 20 distinct cards to fit the graphic.
    const displayCards = nonLands.slice(0, 20);

    return (
        <div className="deck-graphic-card">
            <div className="deck-header">
                <div className="rank-badge">#{deck.rank}</div>
                <div className="deck-info">
                    <h3 className="player-name">{deck.player_name}</h3>
                    <span className="archetype-name">{deck.archetype || 'Unknown Archetype'}</span>
                </div>
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        onView();
                    }}
                    className="view-btn"
                    style={{ cursor: 'pointer', border: 'none', fontSize: '1rem' }}
                >
                    View
                </button>
            </div>
            <div className="visual-grid">
                {displayCards.length > 0 ? displayCards.map((card, idx) => (
                    <div key={idx} className="card-item">
                        <img
                            src={`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(card.name)}&format=image`}
                            alt={card.name}
                            loading="lazy"
                            className="card-img"
                        />
                        <span className="card-qty-badge">{card.count}</span>
                    </div>
                )) : <div className="no-cards">No cards found</div>}
            </div>
        </div>
    );
};

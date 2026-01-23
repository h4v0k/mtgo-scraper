import React, { useEffect, useState } from 'react';
import type { DeckDetail } from '../../services/api';
import { fetchDeck } from '../../services/api';
import './DeckView.css';

interface DeckViewProps {
    deckId: number;
    onBack: () => void;
    onPlayerSearch: (name: string) => void;
}

export const DeckView: React.FC<DeckViewProps> = ({ deckId, onBack, onPlayerSearch }) => {
    const [deck, setDeck] = useState<DeckDetail | null>(null);

    useEffect(() => {
        fetchDeck(deckId).then(setDeck).catch(console.error);
    }, [deckId]);

    if (!deck) return <div className="loading-state">Unsealing Deck...</div>;

    // Group by Mainboard/Sideboard if we had that data, but keeping simple for now
    // We'll just list them.

    return (
        <div className="deck-view">
            <div className="view-header">
                <button className="back-btn" onClick={onBack}>&larr; Back to List</button>
                <div className="player-info-header" style={{ position: 'relative', zIndex: 1000 }}>
                    <h2 style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
                        {deck.player_name.startsWith('Unknown Player') ? (
                            <span className="player-name-text" style={{ color: '#888' }}>
                                {deck.player_name}
                            </span>
                        ) : (
                            <a
                                href="#"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onPlayerSearch(deck.player_name);
                                }}
                                className="player-name-link-btn"
                                title="Search Player History"
                                style={{ userSelect: 'none' }}
                            >
                                {deck.player_name}
                            </a>
                        )}
                    </h2>
                    <div className="view-subtitle">{deck.format} • {deck.id}</div>
                    <div className="external-links" style={{ marginTop: '0.5rem' }}>
                        {deck.source_url && (
                            <a
                                href={deck.source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="goldfish-link"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    color: '#ffa500',
                                    textDecoration: 'none',
                                    fontSize: '0.9rem',
                                    fontWeight: 'bold'
                                }}
                            >
                                <span style={{ fontSize: '1.2rem' }}>
                                    {deck.source_url.includes('mtggoldfish') ? '🧡' : '🔗'}
                                </span>
                                {deck.source_url.includes('mtggoldfish')
                                    ? 'View on MTGGoldfish'
                                    : deck.source_url.includes('mtgtop8')
                                        ? 'View on MTGTop8'
                                        : 'View Source'}
                            </a>
                        )}
                    </div>
                </div>
                <button className="btn-primary" onClick={() => {
                    const sbText = deck.sideboard
                        ? `\n\nSideboard:\n${deck.sideboard.map(c => `${c.count} ${c.name}`).join('\n')}`
                        : '';
                    const fullList = `Main Board:\n${deck.raw_decklist.trim()}${sbText}`;
                    navigator.clipboard.writeText(fullList);
                }}>
                    Copy List
                </button>
            </div>

            <div className="deck-grid">
                <div className="card-column">
                    <h3>Mainboard ({deck.cards.reduce((sum, c) => sum + c.count, 0)})</h3>
                    <div className="card-list">
                        {deck.cards.map((card, idx) => (
                            <div
                                key={idx}
                                className={`card-row ${card.isSpice ? 'spice-card' : ''}`}
                                title={card.isSpice ? 'Spice: Low frequency card in this archetype!' : ''}
                            >
                                <span className="card-count">{card.count}</span>
                                <a
                                    href={`https://scryfall.com/search?q=${encodeURIComponent(card.name)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="card-name"
                                >
                                    {card.name}
                                </a>
                                {card.isSpice && <span className="spice-badge">✦ SPICE</span>}
                            </div>
                        ))}
                    </div>
                </div>

                {deck.sideboard && deck.sideboard.length > 0 && (
                    <div className="card-column">
                        <h3>Sideboard ({deck.sideboard.reduce((sum, c) => sum + c.count, 0)})</h3>
                        <div className="card-list">
                            {deck.sideboard.map((card, idx) => (
                                <div
                                    key={idx}
                                    className={`card-row ${card.isSpice ? 'spice-card' : ''}`}
                                    title={card.isSpice ? 'Spice: Low frequency card in this archetype!' : ''}
                                >
                                    <span className="card-count">{card.count}</span>
                                    <a
                                        href={`https://scryfall.com/search?q=${encodeURIComponent(card.name)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="card-name"
                                    >
                                        {card.name}
                                    </a>
                                    {card.isSpice && <span className="spice-badge">✦ SPICE</span>}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

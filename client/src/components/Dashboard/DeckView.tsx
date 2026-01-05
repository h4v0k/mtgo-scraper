import React, { useEffect, useState } from 'react';
import type { DeckDetail } from '../../services/api';
import { fetchDeck } from '../../services/api';
import './DeckView.css';

interface DeckViewProps {
    deckId: number;
    onBack: () => void;
}

export const DeckView: React.FC<DeckViewProps> = ({ deckId, onBack }) => {
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
                <div>
                    <h2>{deck.player_name}</h2>
                    <div className="view-subtitle">{deck.format} • {deck.id}</div>
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
                                <span className="card-name">{card.name}</span>
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
                                    <span className="card-name">{card.name}</span>
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

import React, { useEffect, useState } from 'react';
import type { DeckSummary } from '../../services/api';
import { fetchArchetypeDecks } from '../../services/api';

interface ArchetypeViewProps {
    archetype: string;
    format: string;
    days: number;
    top8: boolean;
    // New Prop
    selectedEvents: string[];
    onBack: () => void;
    onSelectDeck: (id: number) => void;
}

export const ArchetypeView: React.FC<ArchetypeViewProps> = ({
    archetype, format, days, top8, selectedEvents, onBack, onSelectDeck
}) => {
    const [decks, setDecks] = useState<DeckSummary[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchArchetypeDecks(archetype, format, days, top8, selectedEvents)
            .then(setDecks)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [archetype, format, days, top8, selectedEvents]);

    const getOrdinal = (n: number) => {
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };

    return (
        <div className="archetype-view">
            <div className="view-header">
                <button className="back-btn" onClick={onBack}>&larr; Back to Meta</button>
                <h2>{archetype} <span className="view-subtitle">{format} Decks</span></h2>
            </div>

            {loading ? (
                <div className="loading-state">Summoning Decks...</div>
            ) : (
                <div className="decks-grid">
                    <table className="meta-table">
                        <thead>
                            <tr>
                                <th>Player</th>
                                <th>Event</th>
                                <th>Date</th>
                                <th>Result</th>
                            </tr>
                        </thead>
                        <tbody>
                            {decks.map(deck => (
                                <tr key={deck.id} onClick={() => onSelectDeck(deck.id)}>
                                    <td style={{ fontWeight: 'bold', color: 'var(--color-primary-gold)' }}>
                                        {deck.player_name}
                                        {deck.spice_count > 0 && (
                                            <span
                                                className="spice-indicator"
                                                title={`Contains ${deck.spice_count} spicy (non-meta) cards`}
                                            />
                                        )}
                                    </td>
                                    <td>{deck.event_name || 'League/Challenge'}</td>
                                    <td>{new Date(deck.event_date).toLocaleDateString()}</td>
                                    <td>{deck.rank ? getOrdinal(deck.rank) : '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {decks.length === 0 && <div className="empty-state">No decks found.</div>}
                </div>
            )}
        </div>
    );
};

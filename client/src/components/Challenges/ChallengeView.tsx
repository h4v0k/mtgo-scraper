import React, { useEffect, useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import { fetchChallengeResults } from '../../services/api';
import type { ChallengeResult, DeckDetail, Card } from '../../services/api';
import { DeckView } from '../Dashboard/DeckView';
import './ChallengeView.css';

export const ChallengeView: React.FC = () => {
    const [format, setFormat] = useState('Standard');
    const [date, setDate] = useState<string>('');
    const [data, setData] = useState<ChallengeResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [selectedDeckId, setSelectedDeckId] = useState<number | null>(null);
    const eventRefs = useRef<Record<string, HTMLDivElement | null>>({});

    useEffect(() => {
        setLoading(true);
        fetchChallengeResults(format, date)
            .then(res => {
                setData(res);
                if (res.date) setDate(res.date);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [format, date]);

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setDate(e.target.value);
    };

    const exportTop4 = async (eventName: string) => {
        const element = eventRefs.current[eventName];
        if (!element) return;

        try {
            const canvas = await html2canvas(element, {
                backgroundColor: '#1a1a1a',
                useCORS: true,
                scale: 2 // Higher quality
            });
            const link = document.createElement('a');
            link.download = `${eventName.replace(/[:/@\s]+/g, '_')}_Top4.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (err) {
            console.error("Failed to export top 4 image:", err);
            alert("Export failed. Please try again.");
        }
    };

    const handleExportDeck = (deck: DeckDetail) => {
        const main = deck.cards.map(c => `${c.count} ${c.name}`).join('\n');
        const side = (deck.sideboard || []).map(c => `${c.count} ${c.name}`).join('\n');
        const content = `${main}\n\nSideboard\n${side}`;
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${deck.player_name}_${deck.archetype}.txt`;
        link.click();
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
                    <h2 className="results-header">Daily Results - {data.date} ({format})</h2>

                    {data.events.map((event, idx) => (
                        <div key={idx} className="event-section">
                            <div className="event-header-row">
                                <h3 className="event-subheader">
                                    {event.event_name}
                                    {!event.is_valid_top4 && <span className="validation-warning">⚠️ Incomplete Top 4</span>}
                                </h3>
                                <button
                                    onClick={() => exportTop4(event.event_name)}
                                    className="export-graphic-btn"
                                >
                                    📸 Export Top 4 Graphic
                                </button>
                            </div>

                            <div
                                className="top-decks-visual-container"
                                ref={el => { eventRefs.current[event.event_name] = el; }}
                            >
                                <div className="graphic-overlay-header">
                                    <span className="graphic-title">{event.event_name}</span>
                                    <span className="graphic-date">{data.date}</span>
                                </div>
                                <div className="top-decks-grid">
                                    {event.decks.slice(0, 4).map((deck) => (
                                        <DeckCardGrid
                                            key={deck.id}
                                            deck={deck}
                                            onView={() => setSelectedDeckId(deck.id)}
                                            onExport={() => handleExportDeck(deck)}
                                        />
                                    ))}
                                </div>
                                <div className="graphic-footer">
                                    Havok's Spyglass | mtgo-scraper
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

interface DeckCardProps {
    deck: DeckDetail;
    onView: () => void;
    onExport: () => void;
}

const DeckCardGrid: React.FC<DeckCardProps> = ({ deck, onView, onExport }) => {
    // Priority cards for visual display (non-lands, high impact)
    const mainCards = (deck.cards || [])
        .filter(c => !isBasicLand(c.name))
        .slice(0, 12); // Show top 12 mainboard

    const sideCards = (deck.sideboard || [])
        .filter(c => !isBasicLand(c.name))
        .slice(0, 6); // Show top 6 sideboard

    return (
        <div className="deck-graphic-card">
            <div className="deck-card-header">
                <div className="rank-and-player">
                    <span className="rank-badge">#{deck.rank}</span>
                    <div className="player-archetype">
                        <span className="player-name">{deck.player_name}</span>
                        <span className="archetype-label">{deck.archetype || 'Unknown'}</span>
                    </div>
                </div>
                <div className="card-actions">
                    <button onClick={onView} className="action-btn view">View</button>
                    <button onClick={onExport} className="action-btn export">List</button>
                </div>
            </div>

            <div className="visual-display">
                <div className="display-section mainboard">
                    {mainCards.map((card, i) => (
                        <div key={i} className="small-card-preview">
                            <img
                                src={`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(card.name)}&format=image&version=small`}
                                alt={card.name}
                                title={card.name}
                                loading="lazy"
                            />
                            <span className="qty">{card.count}</span>
                        </div>
                    ))}
                </div>
                <div className="display-section sideboard">
                    {sideCards.map((card, i) => (
                        <div key={i} className="small-card-preview side">
                            <img
                                src={`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(card.name)}&format=image&version=small`}
                                alt={card.name}
                                title={card.name}
                                loading="lazy"
                            />
                            <span className="qty">{card.count}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

function isBasicLand(name: string): boolean {
    return ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'].some(land => name.includes(land) && !name.includes(' '));
}


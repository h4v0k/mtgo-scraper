import React, { useEffect, useState } from 'react';
import { fetchEvents } from '../../services/api';
import './Controls.css'; // Reusing styles

interface EventFilterProps {
    format: string;
    days: number;
    selectedEvents: string[];
    onChange: (events: string[]) => void;
}

export const EventFilter: React.FC<EventFilterProps> = ({ format, days, selectedEvents, onChange }) => {
    const [availableEvents, setAvailableEvents] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        let active = true;
        async function load() {
            setLoading(true);
            try {
                const events = await fetchEvents(format, days);
                if (active) {
                    setAvailableEvents(events);
                    // On initial load (or format change), if no events selected, default to ALL EXCEPT Leagues
                    if (selectedEvents.length === 0 && events.length > 0) {
                        const challenges = events.filter(e => e.toLowerCase().includes('challenge'));
                        // Fallback to all if no challenges found (unlikely but safe)
                        onChange(challenges.length > 0 ? challenges : events);
                    }
                    // If existing selection is stale (event no longer exists), filter it out
                    else if (selectedEvents.length > 0) {
                        const valid = selectedEvents.filter(e => events.includes(e));
                        // If format changed completely, valid might be empty. Reset to default (Challenges).
                        if (valid.length === 0 && events.length > 0) {
                            const challenges = events.filter(e => e.toLowerCase().includes('challenge'));
                            onChange(challenges.length > 0 ? challenges : events);
                        } else if (valid.length !== selectedEvents.length) {
                            onChange(valid);
                        }
                    }
                }
            } finally {
                if (active) setLoading(false);
            }
        }
        load();
        return () => { active = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [format, days]);

    const toggleEvent = (event: string) => {
        if (selectedEvents.includes(event)) {
            onChange(selectedEvents.filter(e => e !== event));
        } else {
            onChange([...selectedEvents, event]);
        }
    };

    const toggleAll = () => {
        if (selectedEvents.length === availableEvents.length) {
            onChange([]);
        } else {
            onChange(availableEvents);
        }
    };

    return (
        <div className="control-group event-filter-group">
            <label>Events</label>
            <div className="custom-select-container">
                <button
                    className="custom-select-trigger"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    {loading ? 'Loading...' : `${selectedEvents.length} selected`}
                    <span className="arrow">{isOpen ? '▲' : '▼'}</span>
                </button>

                {isOpen && (
                    <div className="custom-select-dropdown">
                        <div className="dropdown-actions">
                            <button className="text-btn" onClick={toggleAll}>
                                {selectedEvents.length === availableEvents.length ? 'Clear All' : 'Select All'}
                            </button>
                        </div>
                        {availableEvents.map(event => (
                            <div key={event} className="dropdown-item" onClick={() => toggleEvent(event)}>
                                <input
                                    type="checkbox"
                                    checked={selectedEvents.includes(event)}
                                    readOnly
                                />
                                <span>{event}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {/* Overlay to close on click outside */}
            {isOpen && <div className="overlay-click-absorber" onClick={() => setIsOpen(false)} />}
        </div>
    );
};

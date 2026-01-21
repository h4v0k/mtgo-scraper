
import React, { useState, useEffect } from 'react';
import './Controls.css';
import { EventFilter } from './EventFilter';
import { fetchEvents } from '../../services/api';

interface ControlsProps {
    format: string;
    setFormat: (f: string) => void;
    days: number;
    setDays: (d: number) => void;
    top8: boolean;
    setTop8: (b: boolean) => void;
    selectedEvents: string[];
    setSelectedEvents: (events: string[]) => void;
    onCustomDateChange?: (date: string) => void;
    startDate?: string;
}

const FORMATS = ['Standard', 'Modern', 'Legacy', 'Pauper', 'Pioneer'];

export function DashboardControls({
    format, setFormat,
    days, setDays,
    top8, setTop8,
    selectedEvents, setSelectedEvents,
    onCustomDateChange,
    startDate
}: ControlsProps) {
    const [, setAvailableEvents] = useState<string[]>([]); // Keep for future use if needed, or remove. Using empty destructure to satisfy lint if I keep the call.
    const [filterStartDate, setFilterStartDate] = useState(startDate || '');

    // Note: EventFilter likely handles its own fetching or we pass availableEvents to it. 
    // The previous code had EventFilter taking 'format' and 'days' and doing its own thing, 
    // OR we passed availableEvents to it.
    // Looking at the previous file content, EventFilter took 'format', 'days', 'selectedEvents', 'onChange'. 
    // It implies EventFilter *also* fetches. 
    // But here we were pre-fetching 'availableEvents' in useEffect. 
    // Let's assume EventFilter is self-contained for now or just keep the pre-fetch logic to verify API connectivity.

    useEffect(() => {
        async function loadEvents() {
            try {
                // Pass start date if we are in custom mode (days=0)
                const events = await fetchEvents(format, days, days === 0 ? filterStartDate : undefined);
                setAvailableEvents(events);
            } catch (e) {
                console.error(e);
            }
        }
        loadEvents();
    }, [format, days, filterStartDate]);

    const handleDateSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = parseInt(e.target.value);
        setDays(val);
        // Reset custom date if switching back to preset
        if (val !== 0 && onCustomDateChange) onCustomDateChange('');
        else if (val === 0 && onCustomDateChange) onCustomDateChange(filterStartDate); // Re-apply current custom date if switching TO custom
    };

    const handleCustomDateInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const date = e.target.value;
        setFilterStartDate(date);
        if (onCustomDateChange) onCustomDateChange(date);
    };

    return (
        <div className="dashboard-controls card">
            <div className="control-group">
                <label>Format</label>
                <select value={format} onChange={(e) => setFormat(e.target.value)}>
                    {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
            </div>

            <EventFilter
                format={format}
                days={days}
                selectedEvents={selectedEvents}
                onChange={setSelectedEvents}
            />

            <div className="control-group">
                <label>Time Range</label>
                <div className="time-select-container">
                    <select
                        value={days}
                        onChange={handleDateSelect}
                        className="spyglass-select"
                        style={{ width: '100%', marginBottom: days === 0 ? '0.5rem' : '0' }}
                    >
                        <option value={3}>Last 3 Days</option>
                        <option value={7}>Last 7 Days</option>
                        <option value={14}>Last 14 Days</option>
                        <option value={30}>Last 30 Days</option>
                        <option value={0}>Custom Date</option>
                    </select>
                    {days === 0 && (
                        <input
                            type="date"
                            className="custom-date-input"
                            value={filterStartDate}
                            onChange={handleCustomDateInput}
                            style={{ width: '100%', padding: '0.5rem', background: '#2a2a2a', border: '1px solid #444', color: '#fff', borderRadius: '4px' }}
                        />
                    )}
                </div>
            </div>

            <div className="control-group radio-group">
                <label>Result Type</label>
                <div className="radio-options">
                    <label>
                        <input
                            type="radio"
                            checked={!top8}
                            onChange={() => setTop8(false)}
                        />
                        All Results
                    </label>
                    <label>
                        <input
                            type="radio"
                            checked={top8}
                            onChange={() => setTop8(true)}
                        />
                        Top 8 Only
                    </label>
                </div>
            </div>
        </div>
    );
}

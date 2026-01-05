import React from 'react';
import './Controls.css';
import { EventFilter } from './EventFilter';

interface DashboardControlsProps {
    format: string;
    setFormat: (f: string) => void;
    days: number;
    setDays: (d: number) => void;
    top8: boolean;
    setTop8: (b: boolean) => void;
    // New Props
    selectedEvents: string[];
    setSelectedEvents: (e: string[]) => void;
}

const FORMATS = ['Standard', 'Modern', 'Legacy', 'Pauper', 'Pioneer'];
const DAY_OPTIONS = [3, 7, 14, 30];

export const DashboardControls: React.FC<DashboardControlsProps> = ({
    format,
    setFormat,
    days,
    setDays,
    top8,
    setTop8,
    selectedEvents,
    setSelectedEvents
}) => {
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
                <div className="btn-group">
                    {DAY_OPTIONS.map(d => (
                        <button
                            key={d}
                            className={days === d ? 'active' : ''}
                            onClick={() => setDays(d)}
                        >
                            {d} Days
                        </button>
                    ))}
                </div>
            </div>

            <div className="control-group radio-group">
                <label>View</label>
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
};

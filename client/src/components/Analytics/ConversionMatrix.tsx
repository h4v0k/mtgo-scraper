import { useState, useEffect, useMemo, useRef } from 'react';
import { fetchConversionMetrics, type ConversionMetric } from '../../services/api';
import './ConversionMatrix.css';

export function ConversionMatrix() {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<ConversionMetric[]>([]);
    const [format, setFormat] = useState('Standard');
    const [days, setDays] = useState(14);

    const [view, setView] = useState<'chart' | 'table'>('table');

    // Tooltip State
    const [hoveredPoint, setHoveredPoint] = useState<ConversionMetric | null>(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadData();
    }, [format, days]);

    async function loadData() {
        setLoading(true);
        try {
            const res = await fetchConversionMetrics(format, days);
            setData(res);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    // Chart Configuration
    const PADDING = { TOP: 20, RIGHT: 40, BOTTOM: 40, LEFT: 60 };
    const WIDTH = 1000;
    const HEIGHT = 600;

    // Scales
    const maxPresence = useMemo(() => Math.max(...data.map(d => d.presence_pct), 15), [data]);
    const maxConversion = useMemo(() => Math.max(...data.map(d => d.conversion_rate), 50), [data]);

    const getX = (presence: number) => {
        const innerWidth = WIDTH - PADDING.LEFT - PADDING.RIGHT;
        return PADDING.LEFT + (presence / maxPresence) * innerWidth;
    };

    const getY = (conversion: number) => {
        const innerHeight = HEIGHT - PADDING.TOP - PADDING.BOTTOM;
        return HEIGHT - PADDING.BOTTOM - (conversion / maxConversion) * innerHeight;
    };

    const EXPECTED = 25; // 25% Baseline

    // Mouse Handler
    const handleMouseMove = (e: React.MouseEvent, metric: ConversionMetric) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        setTooltipPos({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        });
        setHoveredPoint(metric);
    };

    const sortedData = useMemo(() => {
        return [...data].sort((a, b) => b.conversion_rate - a.conversion_rate);
    }, [data]);

    const getBarColor = (rate: number, expected: number) => {
        if (rate >= expected * 1.5) return 'var(--color-primary)'; // Gold
        if (rate >= expected) return 'var(--color-success)'; // Green
        return 'var(--color-accent)'; // Purple/Low
    };

    return (
        <div className="conversion-matrix-container" ref={containerRef}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2>Metagame Conversion Matrix</h2>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={() => setView('table')}
                        style={{
                            background: view === 'table' ? 'var(--color-primary)' : 'transparent',
                            color: view === 'table' ? '#000' : 'var(--color-primary)',
                            border: '1px solid var(--color-primary)',
                            padding: '4px 12px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        Table
                    </button>
                    <button
                        onClick={() => setView('chart')}
                        style={{
                            background: view === 'chart' ? 'var(--color-primary)' : 'transparent',
                            color: view === 'chart' ? '#000' : 'var(--color-primary)',
                            border: '1px solid var(--color-primary)',
                            padding: '4px 12px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        Chart
                    </button>
                </div>
            </div>

            <div className="controls">
                <select value={format} onChange={e => setFormat(e.target.value)}>
                    <option value="Standard">Standard</option>
                    <option value="Pioneer">Pioneer</option>
                    <option value="Modern">Modern</option>
                    <option value="Legacy">Legacy</option>
                    <option value="Pauper">Pauper</option>
                </select>
                <select value={days} onChange={e => setDays(Number(e.target.value))}>
                    <option value={3}>Last 3 Days</option>
                    <option value={7}>Last 7 Days</option>
                    <option value={14}>Last 14 Days</option>
                    <option value={30}>Last 30 Days</option>
                </select>
                <button onClick={loadData} disabled={loading}>{loading ? 'Calculating...' : 'Refresh'}</button>
            </div>

            {view === 'table' ? (
                <table className="matrix-table">
                    <thead>
                        <tr>
                            <th>Archetype</th>
                            <th>Entries</th>
                            <th>Top 8s</th>
                            <th>Win Rate / Conversion</th>
                            <th>Presence</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedData.map(d => (
                            <tr key={d.archetype}>
                                <td style={{ fontWeight: 'bold', color: 'var(--color-text-main)' }}>{d.archetype}</td>
                                <td>{d.total_count}</td>
                                <td>{d.top8_count}</td>
                                <td style={{ width: '30%' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                                        <span>{d.conversion_rate}%</span>
                                        <span style={{ fontSize: '0.8em', color: 'var(--color-text-muted)' }}>EXP: {EXPECTED}%</span>
                                    </div>
                                    <div className="cell-stat-bar">
                                        <div
                                            className="cell-stat-fill"
                                            style={{
                                                width: `${Math.min(d.conversion_rate, 100)}%`,
                                                background: getBarColor(d.conversion_rate, EXPECTED)
                                            }}
                                        />
                                    </div>
                                </td>
                                <td>{d.presence_pct}%</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : (
                <div className="chart-wrapper">
                    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" height="100%">
                        {/* Background Zones */}
                        <rect
                            x={getX(0)} y={getY(maxConversion)}
                            width={getX(maxPresence) - getX(0)} height={getY(EXPECTED) - getY(maxConversion)}
                            className="zone-rect zone-rogue"
                        />

                        {/* Grid Lines Y */}
                        {[0, 25, 50, 75, 100].map(tick => tick <= maxConversion && (
                            <g key={`y-${tick}`}>
                                <line
                                    x1={PADDING.LEFT} y1={getY(tick)}
                                    x2={WIDTH - PADDING.RIGHT} y2={getY(tick)}
                                    className={`grid-line ${tick === 25 ? 'baseline' : ''}`}
                                    strokeDasharray={tick === 25 ? '0' : '4'}
                                    strokeWidth={tick === 25 ? 2 : 1}
                                    stroke={tick === 25 ? 'var(--color-text-muted)' : 'rgba(255,255,255,0.1)'}
                                />
                                <text x={PADDING.LEFT - 10} y={getY(tick) + 4} className="axis-label" textAnchor="end">
                                    {tick}%
                                </text>
                            </g>
                        ))}

                        {/* Grid Lines X */}
                        {[0, 5, 10, 15, 20, 25, 30, 40, 50].map(tick => tick <= maxPresence && (
                            <g key={`x-${tick}`}>
                                <line
                                    x1={getX(tick)} y1={HEIGHT - PADDING.BOTTOM}
                                    x2={getX(tick)} y2={PADDING.TOP}
                                    className="grid-line"
                                />
                                <text x={getX(tick)} y={HEIGHT - PADDING.BOTTOM + 20} className="axis-label">
                                    {tick}%
                                </text>
                            </g>
                        ))}

                        {/* Axes Labels */}
                        <text x={WIDTH / 2} y={HEIGHT - 5} className="axis-title" textAnchor="middle">
                            Metagame Presence (%)
                        </text>
                        <text
                            x={-HEIGHT / 2} y={15}
                            className="axis-title"
                            textAnchor="middle"
                            transform="rotate(-90)"
                        >
                            Top 8 Conversion Rate (%)
                        </text>

                        {/* Data Points */}
                        {data.map(d => (
                            <g key={d.archetype}>
                                <circle
                                    cx={getX(d.presence_pct)}
                                    cy={getY(d.conversion_rate)}
                                    r={hoveredPoint?.archetype === d.archetype ? 8 : 5}
                                    fill={d.conversion_rate > EXPECTED ? 'var(--color-primary)' : 'var(--color-accent)'}
                                    className="data-point"
                                    onMouseMove={(e) => handleMouseMove(e, d)}
                                    onMouseLeave={() => setHoveredPoint(null)}
                                />
                                {/* Label for High Presence or High Conversion */}
                                {(d.presence_pct > 5 || d.conversion_rate > 40) && (
                                    <text
                                        x={getX(d.presence_pct)}
                                        y={getY(d.conversion_rate) - 10}
                                        textAnchor="middle"
                                        className="axis-label"
                                        fill="var(--color-text-main)"
                                    >
                                        {d.archetype}
                                    </text>
                                )}
                            </g>
                        ))}
                    </svg>

                    {hoveredPoint && (
                        <div className="tooltip" style={{ left: tooltipPos.x + 15, top: tooltipPos.y + 15 }}>
                            <h4>{hoveredPoint.archetype}</h4>
                            <div className="tooltip-stat">
                                <span>Presence:</span>
                                <span>{hoveredPoint.presence_pct}%</span>
                            </div>
                            <div className="tooltip-stat">
                                <span>Conversion:</span>
                                <span>{hoveredPoint.conversion_rate}%</span>
                            </div>
                            <div className="tooltip-stat">
                                <span>Entries:</span>
                                <span>{hoveredPoint.total_count}</span>
                            </div>
                            <div className="tooltip-stat">
                                <span>Top 8s:</span>
                                <span>{hoveredPoint.top8_count}</span>
                            </div>
                            <div className="tooltip-stat">
                                <span>Wins:</span>
                                <span>{hoveredPoint.wins_count}</span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <p style={{ fontSize: '0.9em', color: 'var(--color-text-muted)', marginTop: '12px' }}>
                * <strong>Conversion Rate</strong>: Percentage of entries that made Top 8.
                <br />
                * <strong>Expected Baseline (25%)</strong>: Assuming typical event structure (Challenge 32), 8 of 32 players (25%) make Top 8. Decks above this line are overperforming.
            </p>
        </div>
    );
}

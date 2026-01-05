import { downloadMetagameCSV } from '../../utils/export';

interface MetaTableProps {
    data: MetaData[];
    onSelectArchetype: (archetype: string) => void;
}

export const MetaTable: React.FC<MetaTableProps> = ({ data, onSelectArchetype }) => {
    if (data.length === 0) {
        return <div className="empty-state">No data found for this selection.</div>;
    }

    // Calculate total for Percentage
    const totalCount = data.reduce((acc, curr) => acc + curr.count, 0);

    // Sort: High count first, but force "Unknown" to be last
    const sortedData = [...data].sort((a, b) => {
        if (a.archetype === 'Unknown') return 1;
        if (b.archetype === 'Unknown') return -1;
        return b.count - a.count;
    });

    return (
        <div className="meta-table-container card">
            <div className="meta-table-header-actions">
                <button
                    className="export-csv-btn"
                    onClick={() => downloadMetagameCSV(sortedData)}
                    title="Download as CSV"
                >
                    ⬇ Export CSV
                </button>
            </div>
            <table className="meta-table">
                <thead>
                    <tr>
                        <th>Archetype</th>
                        <th>Decks</th>
                        <th>Meta Share</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedData.map((row) => {
                        const percentage = ((row.count / totalCount) * 100).toFixed(1);
                        return (
                            <tr key={row.archetype} onClick={() => onSelectArchetype(row.archetype)}>
                                <td className="arch-name">{row.archetype}</td>
                                <td>{row.count}</td>
                                <td className="meta-share">
                                    <div className="share-bar-container">
                                        <span className="share-text">{percentage}%</span>
                                        <div
                                            className="share-bar"
                                            style={{ width: `${Math.min(parseFloat(percentage), 100)}%` }}
                                        />
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

import { MetaData } from '../services/api';

/**
 * Converts metagame data to CSV and triggers a browser download.
 * @param data Array of MetaData objects
 */
export const downloadMetagameCSV = (data: MetaData[]) => {
    if (!data || data.length === 0) {
        alert("No data to export.");
        return;
    }

    // 1. Calculate Total for Share calculation
    const totalCount = data.reduce((acc, curr) => acc + curr.count, 0);

    // 2. Define Headers
    const headers = ["Archetype", "Count", "Meta Share (%)"];

    // 3. Map Data to Rows
    const rows = data.map(item => {
        const share = ((item.count / totalCount) * 100).toFixed(2);
        // Escape quotes in archetype names
        const safeName = `"${item.archetype.replace(/"/g, '""')}"`;
        return [safeName, item.count, share].join(",");
    });

    // 4. Combine CSV Content
    const csvContent = [
        headers.join(","),
        ...rows
    ].join("\n");

    // 5. Create Blob and Link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    // 6. Generate Filename with Date
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `metagame_export_${dateStr}.csv`;

    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

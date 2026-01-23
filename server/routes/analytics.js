const express = require('express');
const router = express.Router();
const { db } = require('../db');

// GET /api/analytics/conversion
// Query: format (default: Standard), days (default: 14)
router.get('/conversion', async (req, res) => {
    try {
        const format = req.query.format || 'Standard';
        const days = parseInt(req.query.days || '14', 10);

        // Calculate date filter
        // SQLite: date('now', '-X days')
        const timeframe = `-${days} days`;

        // Fetch all decks for the period (excluding Leagues to avoid 100% win-rate bias)
        // We only need name (archetype), rank, and total counts
        const query = `
            SELECT 
                a.name as archetype,
                d.rank,
                d.player_name,
                d.event_name
            FROM decks d
            JOIN archetypes a ON d.archetype_id = a.id
            WHERE d.format = ? 
            AND d.event_date >= date('now', ?)
            AND a.name != 'Unknown'
            AND d.event_name NOT LIKE '%League%'
            AND d.rank > 0
        `;

        const result = await db.execute({
            sql: query,
            args: [format, timeframe]
        });

        const decks = result.rows;
        const totalDecks = decks.length;

        if (totalDecks === 0) {
            return res.json([]);
        }

        // Processing
        const stats = {};

        for (const deck of decks) {
            const name = deck.archetype;
            if (!stats[name]) {
                stats[name] = {
                    archetype: name,
                    total_count: 0,
                    top8_count: 0,
                    wins_count: 0
                };
            }
            stats[name].total_count++;

            if (deck.rank && deck.rank <= 8) {
                stats[name].top8_count++;
            }
            if (deck.rank === 1) {
                stats[name].wins_count++;
            }
        }

        // Calculate Derived Metrics and Format Response
        const response = Object.values(stats)
            .map(s => {
                const presence = s.total_count / totalDecks;
                const conversion = s.total_count > 0 ? (s.top8_count / s.total_count) : 0;

                // Baseline expected conversion:
                // Most events are Challenge 32 (8/32 = 25%) or Challenge 64 (8/64 = 12.5%).
                // If we assume a mix, ~20-25% is a "fair" baseline. 
                // However, rank data availability might skew this if we scrape top 32 only.
                // For Scatter plot, strict value matters less than relative value.

                return {
                    archetype: s.archetype,
                    total_count: s.total_count,
                    top8_count: s.top8_count,
                    wins_count: s.wins_count,
                    presence_pct: parseFloat((presence * 100).toFixed(2)),
                    conversion_rate: parseFloat((conversion * 100).toFixed(2))
                };
            })
            .filter(s => s.total_count >= 5) // Filter small sample size (noise)
            .sort((a, b) => b.presence_pct - a.presence_pct);

        res.json(response);

    } catch (err) {
        console.error("Analytics Error:", err);
        res.status(500).json({ error: "Failed to generate analytics" });
    }
});

module.exports = router;

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const { db, initDB } = require('./db'); // Import db and init helper
require('./services/scraper'); // Initialize scraper

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// --- Authentication Middleware ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// --- Routes ---

// Login
// Login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const result = await db.execute({
            sql: 'SELECT * FROM users WHERE username = ?',
            args: [username]
        });
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Check password
        if (bcrypt.compareSync(password, user.password_hash)) {
            // Log the login
            const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
            const userAgent = req.headers['user-agent'];

            await db.execute({
                sql: 'INSERT INTO login_logs (user_id, ip_address, user_agent) VALUES (?, ?, ?)',
                args: [user.id, ip, userAgent]
            });

            // Generate Token
            const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '12h' });
            res.json({ token, username: user.username });
        } else {
            res.status(401).json({ message: 'Invalid credentials' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Create User (Internal/Seed only - typically you wouldn't expose this openly)
// Create User (Internal/Seed only - typically you wouldn't expose this openly)
app.post('/api/admin/create-user', async (req, res) => {
    // In a real app, protect this route. For now, we'll leave it open for initial setup or add a hardcoded secret check.
    const { username, password, adminSecret } = req.body;

    if (adminSecret !== process.env.ADMIN_SECRET) {
        return res.status(403).json({ message: 'Forbidden' });
    }

    try {
        const hash = bcrypt.hashSync(password, 10);
        const result = await db.execute({
            sql: 'INSERT INTO users (username, password_hash) VALUES (?, ?)',
            args: [username, hash]
        });
        // result.lastInsertRowid is likely a bigint or string in libsql
        res.json({ id: result.lastInsertRowid.toString(), username });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Dashboard Data
// Dashboard Data
app.get('/api/meta', authenticateToken, async (req, res) => {
    const { format, days, top8, events } = req.query; // events is array or string
    const eventList = events ? (Array.isArray(events) ? events : [events]) : null;

    // Calculate date threshold
    const dateQuery = `date('now', '-${days} days')`;

    const rankFilter = (top8 === 'true') ? 'AND rank <= 8' : '';
    const eventFilter = eventList ? `AND event_name IN (${eventList.map(() => '?').join(',')})` : '';

    let query = `
        SELECT 
            a.name as archetype, 
            COUNT(*) as count,
            (SELECT COUNT(*) FROM decks d2 
             WHERE d2.format = ? 
             AND d2.event_date >= date('now', '-' || ? || ' days') 
             ${rankFilter}
             ${eventFilter}
            ) as total_decks
        FROM decks d
        JOIN archetypes a ON d.archetype_id = a.id
        WHERE d.format = ? 
        AND d.event_date >= date('now', '-' || ? || ' days')
        ${rankFilter}
        ${eventFilter}
    `;

    query += ` GROUP BY a.name ORDER BY count DESC`;

    // Params construction:
    const baseParams = [format, days];
    const eventParams = eventList || [];

    const finalParams = [
        ...baseParams, ...eventParams, // for subquery
        ...baseParams, ...eventParams  // for main query
    ];

    try {
        const result = await db.execute({
            sql: query,
            args: finalParams
        });
        res.json(result.rows);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get Decks for an Archetype
// Get Decks for an Archetype
app.get('/api/meta/archetype/:name', authenticateToken, async (req, res) => {
    const { name } = req.params;
    const { format, days, top8, events } = req.query;
    const eventList = events ? (Array.isArray(events) ? events : [events]) : null;

    let query = `
        SELECT d.id, d.player_name, d.event_name, d.event_date, d.rank
        FROM decks d
        JOIN archetypes a ON d.archetype_id = a.id
        WHERE a.name = ? AND d.format = ?
        AND d.event_date >= date('now', '-' || ? || ' days')
    `;

    // Initialize params with base required values
    const params = [name, format, days];

    if (top8 === 'true') {
        query += ` AND d.rank <= 8`;
    }

    if (eventList && eventList.length > 0) {
        query += ` AND d.event_name IN (${eventList.map(() => '?').join(',')})`;
        params.push(...eventList);
    }

    query += ` ORDER BY d.event_date DESC`;

    try {
        const result = await db.execute({
            sql: query,
            args: params
        });
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get Single Deck with Spice Analysis
// Get Single Deck with Spice Analysis
app.get('/api/deck/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;

    try {
        const deckRes = await db.execute({
            sql: 'SELECT * FROM decks WHERE id = ?',
            args: [id]
        });
        const deck = deckRes.rows[0];

        if (!deck) return res.status(404).json({ message: 'Deck not found' });

        const archetypeId = deck.archetype_id;
        const otherDecksRes = await db.execute({
            sql: `
            SELECT raw_decklist, sideboard FROM decks 
            WHERE archetype_id = ? AND id != ? 
            AND event_date >= date('now', '-30 days')
            `,
            args: [archetypeId, id]
        });
        const otherDecks = otherDecksRes.rows;

        const cardCounts = {};
        let totalDecks = otherDecks.length;

        const processList = (list) => {
            if (!list) return;
            const lines = list.split('\n');
            lines.forEach(line => {
                const parts = line.trim().split(' ');
                const count = parseInt(parts[0]);
                if (!isNaN(count)) {
                    const cardName = parts.slice(1).join(' ');
                    cardCounts[cardName] = (cardCounts[cardName] || 0) + 1;
                }
            });
        };

        otherDecks.forEach(row => {
            processList(row.raw_decklist);
            processList(row.sideboard);
        });

        const analyzeList = (list) => {
            if (!list) return [];
            return list.split('\n').map(line => {
                const parts = line.trim().split(' ');
                const count = parseInt(parts[0]);
                if (!isNaN(count)) {
                    const cardName = parts.slice(1).join(' ');
                    const frequency = (cardCounts[cardName] || 0) / (totalDecks || 1);
                    const isSpice = frequency < 0.20 && totalDecks > 5;
                    return { count, name: cardName, isSpice, frequency };
                }
                return null;
            }).filter(Boolean);
        };

        const mainCards = analyzeList(deck.raw_decklist);
        const sideCards = analyzeList(deck.sideboard);

        res.json({
            ...deck,
            cards: mainCards,
            sideboard: sideCards
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'DB Error' });
    }
});

// Get Available Events
// Get Available Events
app.get('/api/events', authenticateToken, async (req, res) => {
    const { format, days } = req.query;

    // Get unique event names for this format/timeframe
    const query = `
        SELECT DISTINCT event_name 
        FROM decks 
        WHERE format = ? 
        AND event_date >= date('now', '-' || ? || ' days')
        ORDER BY event_name
    `;

    try {
        const result = await db.execute({
            sql: query,
            args: [format, days]
        });
        res.json(result.rows.map(e => e.event_name));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

// Initialize and Start
initDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
});

// Export app for Vercel
module.exports = app;

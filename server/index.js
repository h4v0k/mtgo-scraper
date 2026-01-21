const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const { db, initDB } = require('./db'); // Import db and init helper
const seedRemote = require('./seed_remote');
const scraper = require('./services/scraper');
const goldfish = require('./services/goldfish'); // Import Goldfish service
// require('./services/scraper'); // DISABLE SCRAPER IN VERCEL (Running manually via seed script)

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// --- Lazy Database Initialization Middleware ---
let dbInitialized = false;
app.use(async (req, res, next) => {
    if (!dbInitialized) {
        try {
            await initDB();
            dbInitialized = true;
        } catch (err) {
            console.error("DB Init Failed during request:", err);
            return res.status(500).json({ error: 'Database Initialization Failed', details: err.message });
        }
    }
    next();
});

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

// --- Admin Middleware ---
const requireAdmin = (req, res, next) => {
    if (req.user && req.user.username === 'havok') {
        next();
    } else {
        res.status(403).json({ message: 'Admin access required' });
    }
};

// --- Routes ---
app.use('/api/analytics', require('./routes/analytics'));

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

// Protected: List Users (Admin Only)
app.get('/api/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const result = await db.execute("SELECT id, username, created_at FROM users WHERE username != 'havok' ORDER BY created_at DESC");
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Protected: Create User (Admin Only)
app.post('/api/users', authenticateToken, requireAdmin, async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password required' });
    }

    try {
        const hash = bcrypt.hashSync(password, 10);
        const result = await db.execute({
            sql: 'INSERT INTO users (username, password_hash) VALUES (?, ?)',
            args: [username, hash]
        });
        res.json({ id: result.lastInsertRowid.toString(), username });
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ message: 'Username already exists' });
        }
        res.status(500).json({ error: err.message });
    }
});

// Protected: Delete User (Admin Only)
app.delete('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await db.execute({
            sql: 'DELETE FROM users WHERE id = ?',
            args: [id]
        });
        res.json({ message: 'User deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Protected: Get Login Logs (Admin Only)
app.get('/api/admin/logs', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const result = await db.execute(`
            SELECT l.id, u.username, l.ip_address, l.user_agent, l.login_timestamp 
            FROM login_logs l
            JOIN users u ON l.user_id = u.id
            ORDER BY l.login_timestamp DESC
            LIMIT 50
        `);
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching logs:", err);
        res.status(500).json({ error: "Failed to fetch logs" });
    }
});

// Dashboard Data
// Dashboard Data
app.get('/api/meta', authenticateToken, async (req, res) => {
    let { format, days, top8, events } = req.query; // events is array or string

    // Defaults
    if (!days) days = '7';
    if (!format) format = 'Standard';

    const eventList = events ? (Array.isArray(events) ? events : [events]) : null;

    // Calculate date threshold
    let cutoffStr;
    if (req.query.startDate) {
        cutoffStr = new Date(req.query.startDate).toISOString();
    } else {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));
        cutoffStr = cutoffDate.toISOString();
    }

    const rankFilter = (top8 === 'true') ? 'AND rank <= 8' : '';
    const eventFilter = eventList ? `AND event_name IN (${eventList.map(() => '?').join(',')})` : '';

    let query = `
        SELECT 
            a.name as archetype, 
            COUNT(*) as count,
            (SELECT COUNT(*) FROM decks d2 
             WHERE d2.format = ? 
             AND d2.event_date >= ? 
             ${rankFilter}
             ${eventFilter}
            ) as total_decks
        FROM decks d
        JOIN archetypes a ON d.archetype_id = a.id
        WHERE d.format = ? 
        AND d.event_date >= ?
        ${rankFilter}
        ${eventFilter}
    `;

    query += ` GROUP BY a.name ORDER BY count DESC`;

    // Params construction:
    const baseParams = [format, cutoffStr];
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
    let { format, days, top8, events } = req.query;

    // Defaults
    if (!days) days = '7';
    if (!format) format = 'Standard';

    const eventList = events ? (Array.isArray(events) ? events : [events]) : null;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));
    const cutoffStr = cutoffDate.toISOString();

    let query = `
        SELECT d.id, d.player_name, d.event_name, d.event_date, d.rank, d.raw_decklist, d.sideboard
        FROM decks d
        JOIN archetypes a ON d.archetype_id = a.id
        WHERE a.name = ? AND d.format = ?
        AND d.event_date >= ?
    `;

    // Initialize params with base required values
    const params = [name, format, cutoffStr];

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

        const decks = result.rows;

        // Spice Calculation
        const LANDS = new Set(require('./constants/lands'));
        const cardCounts = {};
        const totalDecks = decks.length;

        const processList = (list) => {
            if (!list) return;
            const lines = list.split('\n');
            lines.forEach(line => {
                const parts = line.trim().split(' ');
                const count = parseInt(parts[0]);
                if (!isNaN(count)) {
                    const cardName = parts.slice(1).join(' ');
                    if (!LANDS.has(cardName) && !cardName.includes('Verge') && !cardName.includes('Land')) {
                        cardCounts[cardName] = (cardCounts[cardName] || 0) + 1;
                    }
                }
            });
        };

        // Build Frequency Map
        decks.forEach(d => {
            processList(d.raw_decklist);
            processList(d.sideboard);
        });

        // Dynamic Spice Threshold: Max 1 or 15% of decks (Strict)
        // For N=6, threshold=1 (Unique only). For N=20, threshold=3.
        let frequencyThreshold = Math.max(1, Math.floor(totalDecks * 0.15));

        // FIX: If sample size is too small, disable spice detection to avoid false positives
        if (totalDecks < 5) {
            frequencyThreshold = -1;
        }

        // Calculate Score per Deck
        const processedDecks = decks.map(deck => {
            let spiceCount = 0;
            const checkSpice = (list) => {
                if (!list) return;
                list.split('\n').forEach(line => {
                    const parts = line.trim().split(' ');
                    if (parseInt(parts[0])) {
                        const cardName = parts.slice(1).join(' ');
                        const deckCount = cardCounts[cardName] || 0;
                        if (deckCount > 0 && deckCount <= frequencyThreshold && !LANDS.has(cardName) && !cardName.includes('Verge') && !cardName.includes('Land')) {
                            spiceCount++;
                        }
                    }
                });
            };
            checkSpice(deck.raw_decklist);
            checkSpice(deck.sideboard);

            // Return summary without heavy text fields
            return {
                id: deck.id,
                player_name: deck.player_name,
                event_name: deck.event_name,
                event_date: deck.event_date,
                rank: deck.rank,
                spice_count: spiceCount
            };
        });

        res.json(processedDecks);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get Single Deck with Spice Analysis
app.get('/api/deck/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;

    try {
        const deckRes = await db.execute({
            sql: `SELECT d.*, a.name as archetype_name, a.id as archetype_id 
                  FROM decks d 
                  LEFT JOIN archetypes a ON d.archetype_id = a.id 
                  WHERE d.id = ?`,
            args: [id]
        });
        const deck = deckRes.rows[0];

        if (!deck) return res.status(404).json({ message: 'Deck not found' });

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 30);
        const cutoffStr = cutoffDate.toISOString();

        // Get context for spice
        const contextRes = await db.execute({
            sql: `SELECT raw_decklist, sideboard FROM decks 
                  WHERE archetype_id = ? 
                  AND event_date >= ?`,
            args: [deck.archetype_id, cutoffStr]
        });
        const contextDecks = contextRes.rows;

        // Build Freq Map
        const LANDS = new Set(require('./constants/lands'));
        const cardCounts = {};
        const total = contextDecks.length;

        const processList = (list) => {
            if (!list) return;
            list.split('\n').forEach(line => {
                const parts = line.trim().split(' ');
                const count = parseInt(parts[0]);
                if (!isNaN(count)) {
                    const cardName = parts.slice(1).join(' ');
                    if (!LANDS.has(cardName) && !cardName.includes('Verge') && !cardName.includes('Land')) {
                        cardCounts[cardName] = (cardCounts[cardName] || 0) + 1;
                    }
                }
            });
        };

        contextDecks.forEach(d => {
            processList(d.raw_decklist);
            processList(d.sideboard);
        });

        // Identify Spice Cards (Strict Logic)
        const spiceCards = [];
        let threshold = Math.max(1, Math.floor(total * 0.15));

        // FIX: If sample size is too small, disable spice to avoid flagging entire deck
        if (total < 5) {
            threshold = -1;
        }

        const checkSpice = (list) => {
            if (!list) return;
            list.split('\n').forEach(line => {
                const parts = line.trim().split(' ');
                if (parseInt(parts[0])) {
                    const cardName = parts.slice(1).join(' ');
                    const count = cardCounts[cardName] || 0;
                    if (count > 0 && count <= threshold && !LANDS.has(cardName) && !cardName.includes('Verge') && !cardName.includes('Land')) {
                        if (!spiceCards.includes(cardName)) spiceCards.push(cardName);
                    }
                }
            });
        };

        checkSpice(deck.raw_decklist);
        checkSpice(deck.sideboard);

        res.json({ ...deck, spice_cards: spiceCards });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});


// Get Available Events

// Get Player History (For Gameplay Tab)
app.get('/api/player/:name/history', authenticateToken, async (req, res) => {
    const { name } = req.params;
    let { days } = req.query;
    if (!days) days = '30'; // Default

    try {
        const result = await db.execute({
            sql: `SELECT d.id, d.event_date, d.event_name, d.format, d.rank, a.name as archetype, d.player_name
                  FROM decks d
                  JOIN archetypes a ON d.archetype_id = a.id
                  WHERE d.player_name LIKE ?
                  AND d.event_date >= date('now', '-' || ? || ' days')
                  ORDER BY d.event_date DESC`,
            args: [name, days]
        });
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Search Players (Auto-complete)
app.get('/api/players/search', authenticateToken, async (req, res) => {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json([]);

    try {
        const result = await db.execute({
            sql: `SELECT DISTINCT player_name 
                  FROM decks 
                  WHERE player_name LIKE ? 
                  ORDER BY player_name ASC 
                  LIMIT 10`,
            args: [`%${q}%`]
        });
        res.json(result.rows.map(r => r.player_name));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get External History (Goldfish)
app.get('/api/player/:name/goldfish', authenticateToken, async (req, res) => {
    const { name } = req.params;
    let { days } = req.query;
    if (!days) days = '30';

    try {
        const history = await goldfish.fetchPlayerHistory(name, parseInt(days));
        res.json(history);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


// Get Available Events
app.get('/api/events', authenticateToken, async (req, res) => {
    let { format, days } = req.query;

    // Defaults
    if (!days) days = '7';
    if (!format) format = 'Standard';

    let cutoffStr;
    if (req.query.startDate) {
        cutoffStr = new Date(req.query.startDate).toISOString();
    } else {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));
        cutoffStr = cutoffDate.toISOString();
    }

    // Get unique event names for this format/timeframe
    const query = `
        SELECT DISTINCT event_name 
        FROM decks 
        WHERE format = ? 
        AND event_date >= ?
        ORDER BY event_name
    `;

    try {
        const result = await db.execute({
            sql: query,
            args: [format, cutoffStr]
        });
        res.json(result.rows.map(e => e.event_name));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Health Check (Root)
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

// Ping Check (API-specific for Vercel debugging)
app.get('/api/ping', (req, res) => {
    res.json({ message: 'Pong from Express', timestamp: new Date() });
});

// Full Database Connection Check
app.get('/api/debug', async (req, res) => {
    try {
        const decks = await db.execute("SELECT COUNT(*) as c FROM decks");
        const archetypes = await db.execute("SELECT COUNT(*) as c FROM archetypes");
        const sample = await db.execute("SELECT * FROM decks LIMIT 1");

        res.json({
            status: 'ok',
            decks_count: decks.rows[0].c,
            archetypes_count: archetypes.rows[0].c,
            sample_deck: sample.rows[0],
            db_url_configured: !!process.env.TURSO_DATABASE_URL,
            server_time: new Date().toISOString()
        });
    } catch (err) {
        res.status(500).json({
            error: 'DB Connection Failed',
            details: err.message,
            stack: err.stack
        });
    }
});

// Initialize and Start (Standalone only)
if (require.main === module) {
    initDB().then(() => {
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    });
}

// Export app for Vercel
module.exports = app;

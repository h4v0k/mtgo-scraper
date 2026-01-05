const { db, initDB } = require('./db');
const bcrypt = require('bcrypt');

async function seed() {
    console.log('Initializing Database Schema...');
    await initDB();
    console.log('Seeding Database...');

    // 1. Create User
    try {
        const hash = bcrypt.hashSync('password123', 10);
        // LibSQL syntax: param markers are ? or :name
        await db.execute({
            sql: 'INSERT INTO users (username, password_hash) VALUES (?, ?)',
            args: ['havok', hash]
        });
        console.log('User created: havok / password123');
    } catch (e) {
        // Ignore constraint errors (user exists)
        if (!e.message.includes('UNIQUE constraint failed')) {
            console.log('Error creating user:', e.message);
        } else {
            console.log('User "havok" already exists.');
        }
    }

    // 2. Archetypes
    const archetypes = [
        { name: 'Izzet Murktide', format: 'Modern' },
        { name: 'Rakdos Scam', format: 'Modern' },
        { name: 'Mono Green Tron', format: 'Modern' },
        { name: 'Azorius Control', format: 'Pioneer' }
    ];

    for (const a of archetypes) {
        try {
            await db.execute({
                sql: 'INSERT INTO archetypes (name, format) VALUES (:name, :format)',
                args: a
            });
        } catch (e) { /* ignore duplicates */ }
    }

    // 3. Decks
    // Helper to get archetype ID
    const getArchId = async (name) => {
        const res = await db.execute({
            sql: 'SELECT id FROM archetypes WHERE name = ?',
            args: [name]
        });
        return res.rows[0]?.id;
    };

    const murktideDeck = `
4 Ragavan, Nimble Pilferer
4 Dragon's Rage Channeler
4 Murktide Regent
4 Ledger Shredder
4 Lightning Bolt
4 Unholy Heat
4 Counterspell
2 Spell Pierce
4 Expressive Iteration
4 Consider
18 Island
`.trim();

    // Generic fill function
    async function insertDeck(player, format, archName, rank, dateOffset, list = murktideDeck) {
        const archId = await getArchId(archName);
        if (!archId) return;

        await db.execute({
            sql: `
            INSERT INTO decks (player_name, format, event_name, event_date, rank, archetype_id, raw_decklist)
            VALUES (?, ?, ?, date('now', '-' || ? || ' days'), ?, ?, ?)
            `,
            args: [player, format, 'Modern Challenge', dateOffset, rank, archId, list]
        });
    }

    // Insert logic
    // 10 Murktide Decks
    for (let i = 0; i < 10; i++) await insertDeck(`PlayerM${i}`, 'Modern', 'Izzet Murktide', i + 1, i % 7);

    // 5 Rakdos Decks
    for (let i = 0; i < 5; i++) await insertDeck(`PlayerR${i}`, 'Modern', 'Rakdos Scam', i + 5, i % 7, `4 Grief\n4 Fury\n4 Orcish Bowmasters\n...`);

    // Spice Deck (Izzet Murktide with a weird card)
    const spiceDeck = murktideDeck + '\n1 Storm Crow'; // Storm Crow is definitely spice
    await insertDeck('SpicyPlayer', 'Modern', 'Izzet Murktide', 1, 1, spiceDeck);

    console.log('Database seeded successfully.');
}

seed().catch(err => {
    console.error(err);
    process.exit(1);
});

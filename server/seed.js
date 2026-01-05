const db = require('./db');
const fs = require('fs');

console.log('Seeding Database...');

// 1. Create User
try {
    const bcrypt = require('bcrypt');
    const hash = bcrypt.hashSync('password123', 10);
    db.prepare('INSERT OR IGNORE INTO users (id, username, password_hash) VALUES (1, ?, ?)').run('havok', hash);
    console.log('User created: havok / password123');
} catch (e) { console.log('User skipping', e.message) }

// 2. Archetypes
const archetypes = [
    { name: 'Izzet Murktide', format: 'Modern' },
    { name: 'Rakdos Scam', format: 'Modern' },
    { name: 'Mono Green Tron', format: 'Modern' },
    { name: 'Azorius Control', format: 'Pioneer' }
];

archetypes.forEach(a => {
    db.prepare('INSERT OR IGNORE INTO archetypes (name, format) VALUES (@name, @format)').run(a);
});

// 3. Decks
// Helper to get archetype ID
const getArchId = (name) => db.prepare('SELECT id FROM archetypes WHERE name = ?').get(name).id;

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
function insertDeck(player, format, archName, rank, dateOffset, list = murktideDeck) {
    db.prepare(`
        INSERT INTO decks (player_name, format, event_name, event_date, rank, archetype_id, raw_decklist)
        VALUES (?, ?, ?, date('now', '-' || ? || ' days'), ?, ?, ?)
    `).run(player, format, 'Modern Challenge', dateOffset, rank, getArchId(archName), list);
}

// Insert logic
// 10 Murktide Decks
for (let i = 0; i < 10; i++) insertDeck(`PlayerM${i}`, 'Modern', 'Izzet Murktide', i + 1, i % 7);

// 5 Rakdos Decks
for (let i = 0; i < 5; i++) insertDeck(`PlayerR${i}`, 'Modern', 'Rakdos Scam', i + 5, i % 7, `4 Grief\n4 Fury\n4 Orcish Bowmasters\n...`);

// Spice Deck (Izzet Murktide with a weird card)
const spiceDeck = murktideDeck + '\n1 Storm Crow'; // Storm Crow is definitely spice
insertDeck('SpicyPlayer', 'Modern', 'Izzet Murktide', 1, 1, spiceDeck);

console.log('Database seeded successfully.');

const db = require('./db');

// Clear existing
db.prepare("DELETE FROM decks").run();
db.prepare("DELETE FROM archetypes").run();

// Modern Archetypes
const archetypes = [
    "Boros Energy", "Ruby Storm", "Affinity", "Jeskai Control", "Mono Black Necro",
    "Eldrazi Tron", "Yawgmoth Combo", "Living End", "Amulet Titan", "Murktide Regent"
];

// Ensure Archetypes exist
const archMap = {};
archetypes.forEach(name => {
    const info = db.prepare('INSERT INTO archetypes (name, format) VALUES (?, ?) RETURNING id').get(name, 'Modern');
    archMap[name] = info.id;
});

// Mock Players
const players = [
    "VizosMTG", "MeninoNey", "RespectTheCat", "O_danielakos", "SoulStrong",
    "Kanister", "AspiringSpike", "Yellowhat", "Mengu09", "ReidDuke",
    "LSV", "PVDDR", "Autumn", "Nassif", "Wafo-Tapa"
];

// Mock Decklists (Shortened for brevity but realistic cards)
const decklists = {
    "Boros Energy": "4 Guide of Souls\n4 Ocelot Pride\n4 Phlage\n4 Galvanic Discharge\n4 Static Prison\n20 Lands",
    "Ruby Storm": "4 Ral, Monsoon Mage\n4 Ruby Medallion\n4 Glimpse the Impossible\n4 Desperate Ritual\n20 Mountain",
    "Affinity": "4 Simulacrum Synthesizer\n4 Frogmyr Enforcer\n4 Thought Monitor\n4 Springleaf Drum\n4 Urza's Saga",
    "Jeskai Control": "4 The One Ring\n4 Phlage\n4 Counterspell\n4 Solitude\n24 Lands",
    "Mono Black Necro": "4 Necrodominance\n4 Grief\n4 Soul Spike\n4 Sheoldred\n20 Swamps",
    "Eldrazi Tron": "4 Reality Smasher\n4 Thought-Knot Seer\n4 Chalice of the Void\n4 Eldrazi Temple\n12 Urza Lands",
    "Yawgmoth Combo": "4 Yawgmoth, Thran Physician\n4 Young Wolf\n4 Orcish Bowmasters\n4 Grist, the Hunger Tide\n20 Lands",
    "Living End": "4 Living End\n4 Shardless Agent\n4 Violent Outburst\n4 Grief\n15 Lands",
    "Amulet Titan": "4 Primeval Titan\n4 Amulet of Vigor\n4 The One Ring\n4 Dryad of the Ilysian Grove\n28 Lands",
    "Murktide Regent": "4 Murktide Regent\n4 Ragavan\n4 Counterspell\n4 Expressive Iteration\n18 Lands"
};

console.log("Seeding Modern Challenge...");

// Generate Top 32
for (let i = 1; i <= 32; i++) {
    const rank = i;
    const player = players[i % players.length] + (Math.floor(Math.random() * 100)); // Unique-ish name
    const archName = archetypes[i % archetypes.length];
    const archId = archMap[archName];
    const decklist = decklists[archName];

    db.prepare(`
        INSERT INTO decks (player_name, format, event_name, event_date, rank, archetype_id, raw_decklist, source_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        player,
        'Modern',
        'Modern Challenge 32 (Simulated)',
        new Date().toISOString(),
        rank,
        archId,
        decklist,
        'https://www.mtgo.com/decklist/simulated-challenge-' + i
    );
    console.log(`Rank ${rank}: ${player} (${archName})`);
}

console.log("Done.");

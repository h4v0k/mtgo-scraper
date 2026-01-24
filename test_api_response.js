const httpClient = require('./server/services/httpClient');

async function testAPI() {
    try {
        const response = await httpClient.get('http://localhost:3001/api/challenges?format=Standard');
        const data = response.data;

        console.log('=== API Response ===');
        console.log('Date:', data.date);
        console.log('Number of events:', data.events.length);
        console.log('\n=== Events Detail ===');

        data.events.forEach((event, i) => {
            console.log(`\nEvent ${i + 1}: ${event.event_name}`);
            console.log(`  Number of decks: ${event.decks.length}`);
            console.log(`  Ranks: ${event.decks.map(d => `#${d.rank} ${d.player_name}`).join(', ')}`);

            // Check for duplicate ranks
            const ranks = event.decks.map(d => d.rank);
            const duplicates = ranks.filter((r, idx) => ranks.indexOf(r) !== idx);
            if (duplicates.length > 0) {
                console.log(`  ⚠️  DUPLICATE RANKS FOUND: ${duplicates.join(', ')}`);
            }
        });

        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

testAPI();

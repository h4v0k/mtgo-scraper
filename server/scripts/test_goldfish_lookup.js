const { getArchetypeForDeck } = require('../services/goldfishService');

async function test() {
    console.log("Testing Goldfish Lookup...");

    // Test Case 1: Known Player/Event (from my investigation)
    // Player: SoIMBAGallade
    // Event: Standard Challenge 32
    // Date: 2025-07-12 (need to confirm actual date from investigation or just pick a recent one if I can find it)
    // Actually, I saw "Standard Challenge 32 2025-07-12" in the artifact.

    // Note: The date in the artifact "mtggoldfish_player_search_investigation" was 2025-07-12?
    // Wait, the artifact showed a screenshot but I can't read the text from the artifact metadata alone unless I recall the browser output.
    // The browser output said: "Date: (e.g., 2025-07-12) Event: (e.g., Standard Challenge 32 2025-07-12)"
    // So I can use that.

    const player = "SoIMBAGallade";
    const event = "Standard Challenge 32";
    const date = "2025-07-12";
    const format = "Standard";

    console.log(`\nCase 1: ${player} @ ${event} (${date})`);
    const arch1 = await getArchetypeForDeck(player, event, date, format);
    console.log(`Result: ${arch1}`);

    // Test Case 2: Random recent player (might fail if data old, but let's try a failure case)
    console.log(`\nCase 2: Non-existent player`);
    const arch2 = await getArchetypeForDeck("MadeUpPlayer123456", "Fake Event", "2025-01-01", "Modern");
    console.log(`Result: ${arch2}`);

    // Test Case 3: Gul_Dukat (Known MTGO Grinder)
    // I need a real date/event for meaningful test.
    // I'll skip specific real case 3 unless I query the DB for a recent deck.
    // Alternatively, I can just trust Case 1 if the date I saw was real.
}

test();

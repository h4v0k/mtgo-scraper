const LANDS = new Set(require('../constants/lands'));

/**
 * Calculates the "Spice" score for a deck based on the archetype context.
 * @param {Object} deck - The deck object { raw_decklist, sideboard }
 * @param {Array} contextDecks - Array of deck objects from the same archetype
 * @returns {Object} { count: number, cards: Array<string> }
 */
function calculateSpice(deck, contextDecks) {
    if (!contextDecks || contextDecks.length < 5) {
        return { count: 0, cards: [] };
    }

    const cardCounts = {};
    const totalDecks = contextDecks.length;

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

    // Build Frequency Map from Context
    contextDecks.forEach(d => {
        processList(d.raw_decklist);
        processList(d.sideboard);
    });

    // Dynamic Spice Threshold: Max 1 or 15% of decks (Strict)
    let frequencyThreshold = Math.max(1, Math.floor(totalDecks * 0.15));

    const spiceCards = [];

    const checkSpice = (list) => {
        if (!list) return;
        list.split('\n').forEach(line => {
            const parts = line.trim().split(' ');
            if (parseInt(parts[0])) {
                const cardName = parts.slice(1).join(' ');
                const deckCount = cardCounts[cardName] || 0;
                // It is spicy if it appears in the archetype context (deckCount > 0)
                // BUT it is rare (<= threshold)
                // Note: If deckCount == 0, it means it's literally unique to this deck compared to context.
                // The original logic required deckCount > 0, implying it had to be seen at least once?
                // Actually, if we are passing the deck ITSELF as part of the context (which we usually do if querying DB),
                // then deckCount will be at least 1.
                // If the deck is NOT in context, deckCount could be 0.
                // Let's assume context includes the deck itself or we handle uniqueness.
                // If deckCount is 0, it is VERY spicy (unique).

                const isRare = deckCount <= frequencyThreshold;
                const isLand = LANDS.has(cardName) || cardName.includes('Verge') || cardName.includes('Land');

                if (isRare && !isLand) {
                    if (!spiceCards.includes(cardName)) spiceCards.push(cardName);
                }
            }
        });
    };

    checkSpice(deck.raw_decklist);
    checkSpice(deck.sideboard);

    return {
        count: spiceCards.length,
        cards: spiceCards
    };
}

module.exports = { calculateSpice };

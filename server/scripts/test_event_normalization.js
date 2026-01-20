const { getArchetypeForDeck } = require('../services/goldfishService');

// Extract the normalization logic for testing since it's not exported
function normalizeEventName(name) {
    if (!name) return '';
    return name.toLowerCase()
        .replace(/ \d{4}-\d{2}-\d{2}/, '') // Remove date
        .replace(/ \d+$/, '') // Remove trailing numbers
        .replace('showcase ', '')
        .trim();
}

const cases = [
    ["MTGO RC Super Qualifier", "Pioneer RC Super Qualifier 2026-01-02"],
    ["MTGO Challenge 32", "Pauper Challenge 32 2026-01-03"],
    ["MTGO League", "Legacy League 2026-01-04"],
    ["MTGO Challenge 64", "Modern Challenge 64 2026-01-03"],
    ["MTGO Preliminary", "Modern Preliminary 2026-01-03"],
    // Mismatches that SHOULD fail
    ["MTGO League", "Modern Challenge 2026-01-04"],
    ["MTGO Challenge 32", "Modern Preliminary"]
];

console.log("Current Normalization Test:");
cases.forEach(([scraped, goldfish]) => {
    const n1 = normalizeEventName(scraped);
    const n2 = normalizeEventName(goldfish);
    console.log(`"${scraped}" vs "${goldfish}" -> "${n1}" vs "${n2}" [Match: ${n1 === n2}]`);
});

// Proposed Better Normalization
function betterNormalize(name) {
    if (!name) return '';
    return name.toLowerCase()
        .replace(/ \d{4}-\d{2}-\d{2}/, '') // Remove date
        .replace(/ \d+$/, '') // Remove trailing numbers
        .replace(/mtgo /g, '') // Remove generic MTGO prefix
        .replace(/(modern|pioneer|legacy|pauper|standard|vintage) /g, '') // Remove format prefix
        .replace('showcase ', '')
        .replace('super ', '') // Maybe? "RC Super Qualifier" vs "RC Qualifier"? Need to check if user cares. 
        // Actually "RC Super Qualifier" was in both.
        .trim();
}

console.log("\nProposed Normalization Test:");
cases.forEach(([scraped, goldfish]) => {
    const n1 = betterNormalize(scraped);
    const n2 = betterNormalize(goldfish);
    console.log(`"${scraped}" vs "${goldfish}" -> "${n1}" vs "${n2}" [Match: ${n1 === n2}]`);
});

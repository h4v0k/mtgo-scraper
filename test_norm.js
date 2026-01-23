const { normalizeEventNameForStorage } = require('./server/services/dedupService');

const testCases = [
    { name: "Modern League 2026-01-22", format: "Modern", expected: "Modern League" },
    { name: "Standard Challenge 32 2026-01-22 (1)", format: "Standard", expected: "Standard Challenge 32" },
    { name: "Pioneer Preliminary 12345 2026-01-21", format: "Pioneer", expected: "Pioneer Preliminary 12345" },
    { name: "Legacy Showcase Challenge 2026-01-20", format: "Legacy", expected: "Legacy Showcase Challenge" },
    { name: "MTGO League", format: "Modern", expected: "Modern League" },
    { name: "Modern League (2026-01-23)", format: "Modern", expected: "Modern League" },
    { name: "Modern Challenge 64 2025-12-12 (1)", format: "Modern", expected: "Modern Challenge 64" },
    { name: "Modern Challenge 64 2025-12-12", format: "Modern", expected: "Modern Challenge 64" }
];

console.log("--- Normalization Test ---");
let passCount = 0;
for (const tc of testCases) {
    const result = normalizeEventNameForStorage(tc.name, tc.format);
    if (result === tc.expected) {
        console.log(`[PASS] "${tc.name}" -> "${result}"`);
        passCount++;
    } else {
        console.log(`[FAIL] "${tc.name}" -> "${result}" (Expected: "${tc.expected}")`);
    }
}

console.log(`\nPassed ${passCount}/${testCases.length}`);
process.exit(passCount === testCases.length ? 0 : 1);

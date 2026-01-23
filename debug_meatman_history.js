const { fetchPlayerHistory } = require('./server/services/goldfish');

async function debugHistory() {
    console.log("Fetching Goldfish history for TheMeatMan...");
    const history = await fetchPlayerHistory('TheMeatMan', 90);
    console.log("Goldfish Results:");
    console.table(history);
}

debugHistory();

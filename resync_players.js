const { syncPlayerDecks } = require('./server/services/goldfish');
const { db } = require('./server/db');

async function resync() {
    const players = ['Selfeisek', 'Nandisko', 'Scappie', 'Promilx', 'q84', 'Daikal21', 'MJ_23', 'TheMeatMan'];

    for (const p of players) {
        console.log(`Resyncing ${p}...`);
        await syncPlayerDecks(p, 60); // Lookback 60 days
    }
}

resync();

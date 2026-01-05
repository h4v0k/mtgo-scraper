const { createClient } = require('@libsql/client');

console.log('--- DIAGNOSTIC START ---');

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

console.log('URL Length:', url ? url.length : 'MISSING');
console.log('Token Length:', authToken ? authToken.length : 'MISSING');

if (!url) {
    console.error('ERROR: TURSO_DATABASE_URL is not set.');
    process.exit(1);
}

const client = createClient({ url, authToken });

(async () => {
    try {
        console.log('Attempting connection...');
        const rs = await client.execute('SELECT 1 as val');
        console.log('Connection Successful!', rs.rows);
    } catch (e) {
        console.error('Connection Failed:', e.message);
        if (e.cause) console.error('Cause:', e.cause);
    }
})();

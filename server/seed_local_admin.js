
const { db } = require('./db');
const bcrypt = require('bcrypt');

async function seedAdmin() {
    const username = 'admin';
    const password = 'password123';
    const hash = bcrypt.hashSync(password, 10);

    try {
        console.log('Seeding admin user...');
        await db.execute({
            sql: 'INSERT INTO users (username, password_hash) VALUES (?, ?)',
            args: [username, hash]
        });
        console.log(`User '${username}' created successfully.`);
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            console.log(`User '${username}' already exists. Updating password...`);
            await db.execute({
                sql: 'UPDATE users SET password_hash = ? WHERE username = ?',
                args: [hash, username]
            });
            console.log(`User '${username}' password updated.`);
        } else {
            console.error('Error seeding admin:', err);
        }
    }
}

seedAdmin();

const { createClient } = require('@libsql/client');
const path = require('path');
const dotenv = require('dotenv');
// const fs = require('fs'); // Disable fs to avoid serverless issues

dotenv.config();

// FALLBACK CREDENTIALS (EMERGENCY FIX for Production)
// User requested immediate connection fix.
// NOTE: specific protocol change to https:// to ensure HTTP driver is used (safer for Serverless)
const FALLBACK_URL = 'https://mtgo-scraper-h4v0k.aws-us-east-1.turso.io';
const FALLBACK_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Njc1ODExNDMsImlkIjoiOTM4NWE5YWQtM2YwNy00ZmViLWFmMGYtMWQzZjI2ZTg3NmIwIiwicmlkIjoiNGUzZjY2YjYtNDE1NC00OGMzLThjYzMtOGViNThmYzdjMzI4In0.i5NQHQ6ICS0Bk7_rWnZLgKPXthM-tzFPzF1bgyj3C1mwTjsOiN745kDvxa2ft3h9aPfwpnnT8HMfV-Gmz4e9CQ';

// Determine URL: Use TURSO_DATABASE_URL if present, otherwise fallback to hardcoded URL
// Ensure we prefer HTTPS
let url = process.env.TURSO_DATABASE_URL || FALLBACK_URL;
if (url.startsWith('libsql://')) {
    url = url.replace('libsql://', 'https://');
}

const authToken = process.env.TURSO_AUTH_TOKEN || FALLBACK_TOKEN;

console.log(`Initializing Database with URL: ${url}`);

const db = createClient({
    url,
    authToken,
});

// Helper to initialize schema (Must be called asynchronously)
async function initDB() {
    const schema = `
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS login_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            ip_address TEXT,
            user_agent TEXT,
            login_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS archetypes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            format TEXT NOT NULL,
            UNIQUE(name, format)
        );

        CREATE TABLE IF NOT EXISTS decks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            player_name TEXT,
            format TEXT NOT NULL,
            event_name TEXT,
            event_date DATETIME,
            rank INTEGER,
            archetype_id INTEGER,
            source_url TEXT,
            raw_decklist TEXT,
            sideboard TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(archetype_id) REFERENCES archetypes(id)
        );

        -- Index for faster range queries
        CREATE INDEX IF NOT EXISTS idx_decks_date ON decks(event_date);
        CREATE INDEX IF NOT EXISTS idx_decks_format ON decks(format);
    `;

    try {
        await db.executeMultiple(schema);

        // Auto-Migration for existing databases (adds sideboard if missing)
        try {
            await db.execute("ALTER TABLE decks ADD COLUMN sideboard TEXT");
        } catch (e) {
            // Ignore error if column already exists
        }

        try {
            await db.execute("ALTER TABLE decks ADD COLUMN spice_count INTEGER DEFAULT 0");
        } catch (e) {
            // Ignore
        }

        try {
            await db.execute("ALTER TABLE decks ADD COLUMN spice_cards TEXT");
        } catch (e) {
            // Ignore
        }

        console.log('Database initialized successfully.');
    } catch (err) {
        console.error('Failed to initialize database:', err);
    }
}

module.exports = { db, initDB };

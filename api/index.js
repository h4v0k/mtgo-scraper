// Vercel Serverless Entry Point
// This file exists solely to point Vercel to our Express app in /server
const app = require('../server/index.js');

module.exports = app;

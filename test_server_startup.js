try {
    console.log("Loading server/index.js...");
    const app = require('./server/index');
    console.log("Server module loaded successfully.");
    process.exit(0);
} catch (e) {
    console.error("startup CRASHED:", e);
    process.exit(1);
}

module.exports = (req, res) => {
    res.status(200).json({
        message: "Canary is Alive",
        timestamp: new Date().toISOString(),
        env_check: !!process.env.TURSO_DATABASE_URL
    });
};

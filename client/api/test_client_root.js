module.exports = (req, res) => {
    res.json({
        message: "I am inside client/api. The Root Directory is set to CLIENT.",
        timestamp: new Date()
    });
};

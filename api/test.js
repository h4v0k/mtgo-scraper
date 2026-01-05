// Minimal Vercel Function
module.exports = (req, res) => {
    res.status(200).json({
        message: 'Vercel Function is working',
        time: new Date().toISOString()
    });
};

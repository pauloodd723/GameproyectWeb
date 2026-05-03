const jwt = require('jsonwebtoken')
const JWT_SECRET = process.env.JWT_SECRET || 'gameproject_secret_2024'

function requireAuth(req, res, next) {
    const token = req.cookies?.gameToken
    if (!token) return res.status(401).json({ error: 'No autenticado' })

    try {
        req.user = jwt.verify(token, JWT_SECRET)
        next()
    } catch {
        res.clearCookie('gameToken')
        return res.status(401).json({ error: 'Sesión expirada' })
    }
}

module.exports = { requireAuth }

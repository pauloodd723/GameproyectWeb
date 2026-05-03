const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const { pool } = require('../config/mysql')

const JWT_SECRET = process.env.JWT_SECRET || 'gameproject_secret_2024'
const SERVER_INSTANCE_ID = crypto.randomUUID()
const COOKIE_OPTS = {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24h
}

const passwordPolicy = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}$/

function timestamp() {
    return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

async function register(req, res) {
    const { username, password, repeatPassword } = req.body

    if (!username || !password || !repeatPassword)
        return res.status(400).json({ error: 'Todos los campos son requeridos' })

    if (username.trim().length < 3)
        return res.status(400).json({ error: 'El usuario debe tener al menos 3 caracteres' })

    if (password !== repeatPassword)
        return res.status(400).json({ error: 'Las contraseñas no coinciden' })

    if (!passwordPolicy.test(password))
        return res.status(400).json({ error: 'La contraseña necesita mínimo 8 caracteres, una mayúscula, un número y un símbolo' })

    try {
        const [existing] = await pool.execute(
            'SELECT id FROM users WHERE username = ?',
            [username.trim()]
        )
        if (existing.length > 0)
            return res.status(409).json({ error: 'El nombre de usuario ya está en uso' })

        const hash = await bcrypt.hash(password, 10)
        await pool.execute(
            'INSERT INTO users (username, password) VALUES (?, ?)',
            [username.trim(), hash]
        )

        console.log(`[${timestamp()}] [REGISTRO] Nuevo usuario: ${username.trim()}`)
        res.status(201).json({ message: 'Usuario registrado correctamente' })
    } catch (err) {
        console.error('Error en register:', err)
        res.status(500).json({ error: 'Error interno del servidor' })
    }
}

async function login(req, res) {
    const { username, password } = req.body

    if (!username || !password)
        return res.status(400).json({ error: 'Usuario y contraseña requeridos' })

    try {
        const [rows] = await pool.execute(
            'SELECT * FROM users WHERE username = ?',
            [username.trim()]
        )
        if (rows.length === 0)
            return res.status(401).json({ error: 'Usuario o contraseña incorrectos' })

        const user = rows[0]
        const valid = await bcrypt.compare(password, user.password)
        if (!valid)
            return res.status(401).json({ error: 'Usuario o contraseña incorrectos' })

        const token = jwt.sign(
            { id: user.id, username: user.username, sid: SERVER_INSTANCE_ID },
            JWT_SECRET,
            { expiresIn: '24h' }
        )

        // JWT como cookie HttpOnly — no expuesto a JS del cliente
        res.cookie('gameToken', token, COOKIE_OPTS)

        console.log(`[${timestamp()}] [LOGIN] Usuario: ${user.username} | Token JWT generado`)
        console.log(`[${timestamp()}] [TOKEN] ${token}`)

        res.json({ username: user.username })
    } catch (err) {
        console.error('Error en login:', err)
        res.status(500).json({ error: 'Error interno del servidor' })
    }
}

async function me(req, res) {
    const token = req.cookies?.gameToken
    if (!token) return res.status(401).json({ error: 'No autenticado' })

    try {
        const decoded = jwt.verify(token, JWT_SECRET)
        if (decoded.sid !== SERVER_INSTANCE_ID) {
            res.clearCookie('gameToken')
            return res.status(401).json({ error: 'Sesión inválida tras reinicio del servidor' })
        }
        res.json({ username: decoded.username, id: decoded.id })
    } catch {
        res.clearCookie('gameToken')
        res.status(401).json({ error: 'Sesión expirada' })
    }
}

function logout(req, res) {
    res.clearCookie('gameToken')
    res.json({ message: 'Sesión cerrada' })
}

module.exports = { register, login, me, logout }

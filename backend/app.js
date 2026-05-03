require('dotenv').config()
const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const blockRoutes = require('./routes/blockRoutes')
const authRoutes = require('./routes/authRoutes')
const gameRoutes = require('./routes/gameRoutes')
const { initDB } = require('./config/mysql')

const app = express()
const port = process.env.PORT || 3001

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

app.use(cors({
    origin: FRONTEND_URL,
    credentials: true
}))
app.use(express.json())
app.use(cookieParser())

app.get('/', (req, res) => {
    res.send(`
        <h1>API del Juego</h1>
        <ul>
            <li>POST /api/auth/register — Registrar usuario</li>
            <li>POST /api/auth/login — Iniciar sesión (devuelve cookie JWT HttpOnly)</li>
            <li>GET  /api/auth/me — Verificar sesión activa</li>
            <li>POST /api/auth/logout — Cerrar sesión</li>
            <li>POST /api/game/session/start — Iniciar sesión de juego</li>
            <li>POST /api/game/coin — Registrar moneda recogida</li>
            <li>POST /api/game/death — Registrar muerte</li>
            <li>POST /api/game/level-complete — Completar nivel</li>
            <li>GET  /api/game/stats — Estadísticas del jugador</li>
        </ul>
    `)
})

app.use('/api/blocks', blockRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/game', gameRoutes)

initDB().catch(err => console.error('❌ Error iniciando MySQL:', err))

if (process.env.MONGO_URI) {
    mongoose.connect(process.env.MONGO_URI)
        .then(() => console.log('✅ Conectado a MongoDB'))
        .catch(err => console.error('⚠️ MongoDB no disponible:', err.message))
}

const http = require('http')
const socketio = require('socket.io')

const server = http.createServer(app)
const io = socketio(server, {
    cors: { origin: FRONTEND_URL, credentials: true }
})

let players = {}

io.on('connection', (socket) => {
    console.log(`🟢 Usuario conectado: ${socket.id}`)

    socket.on('new-player', (data) => {
        console.log(`👤 Jugador inicializado: ${socket.id}`, data)
        players[socket.id] = {
            id: socket.id,
            position: data.position || { x: 0, y: 0, z: 0 },
            rotation: data.rotation || 0,
            color: data.color || '#ffffff'
        }
        socket.broadcast.emit('spawn-player', {
            id: socket.id,
            position: players[socket.id].position,
            rotation: players[socket.id].rotation,
            color: players[socket.id].color
        })
        socket.emit('players-update', players)
        const others = Object.entries(players)
            .filter(([id]) => id !== socket.id)
            .map(([id, info]) => ({ id, position: info.position, rotation: info.rotation, color: info.color }))
        socket.emit('existing-players', others)
    })

    socket.on('update-position', ({ position, rotation }) => {
        if (players[socket.id]) {
            players[socket.id].position = position
            players[socket.id].rotation = rotation
            socket.broadcast.emit('update-player', { id: socket.id, position, rotation })
        }
    })

    socket.on('disconnect', () => {
        console.log(`🔴 Usuario desconectado: ${socket.id}`)
        delete players[socket.id]
        io.emit('remove-player', socket.id)
        io.emit('players-update', players)
    })
})

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
    console.log(`✅ Servidor corriendo en puerto ${PORT}`)
    console.log(`📋 Frontend permitido: ${FRONTEND_URL}`)
})

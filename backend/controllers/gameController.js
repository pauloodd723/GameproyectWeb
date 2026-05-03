const { pool } = require('../config/mysql')

function timestamp() {
    return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

async function upsertStats(userId, fields) {
    const cols = Object.keys(fields)
    const increments = cols.map(c => `${c} = ${c} + VALUES(${c})`).join(', ')
    const values = Object.values(fields)

    await pool.execute(
        `INSERT INTO player_stats (user_id, ${cols.join(', ')}) VALUES (?, ${cols.map(() => '?').join(', ')})
         ON DUPLICATE KEY UPDATE ${increments}`,
        [userId, ...values]
    )
}

async function startSession(req, res) {
    const userId = req.user.id
    const username = req.user.username
    const { level = 1 } = req.body

    try {
        await upsertStats(userId, { total_attempts: 1 })

        const [countRows] = await pool.execute(
            'SELECT COUNT(*) as cnt FROM game_sessions WHERE user_id = ?',
            [userId]
        )
        const attempt = (countRows[0]?.cnt || 0) + 1

        const [result] = await pool.execute(
            'INSERT INTO game_sessions (user_id, level, attempt) VALUES (?, ?, ?)',
            [userId, level, attempt]
        )
        const sessionId = result.insertId

        console.log(`[${timestamp()}] [SESIÓN] ${username} | Intento #${attempt} | Nivel ${level} | ID:${sessionId}`)
        res.json({ sessionId, attempt })
    } catch (err) {
        console.error('Error en startSession:', err)
        res.status(500).json({ error: 'Error interno' })
    }
}

async function logCoin(req, res) {
    const userId = req.user.id
    const username = req.user.username
    const { level, coinName, sessionId } = req.body

    try {
        await pool.execute(
            'INSERT INTO coin_logs (user_id, session_id, level, coin_name) VALUES (?, ?, ?, ?)',
            [userId, sessionId || null, level, coinName || 'moneda']
        )

        await upsertStats(userId, { global_points: 1 })

        if (sessionId) {
            await pool.execute(
                'UPDATE game_sessions SET coins_collected = coins_collected + 1 WHERE id = ?',
                [sessionId]
            )
        }

        const [rows] = await pool.execute(
            'SELECT global_points FROM player_stats WHERE user_id = ?',
            [userId]
        )
        const globalPoints = rows[0]?.global_points || 0

        console.log(`[${timestamp()}] [MONEDA] ${username} | Recogió "${coinName}" en Nivel ${level} | Total global: ${globalPoints}`)
        res.json({ globalPoints })
    } catch (err) {
        console.error('Error en logCoin:', err)
        res.status(500).json({ error: 'Error interno' })
    }
}

async function logDeath(req, res) {
    const userId = req.user.id
    const username = req.user.username
    const { level, sessionId } = req.body

    try {
        await upsertStats(userId, { total_deaths: 1 })

        if (sessionId) {
            await pool.execute(
                'UPDATE game_sessions SET deaths = deaths + 1 WHERE id = ?',
                [sessionId]
            )
        }

        console.log(`[${timestamp()}] [MUERTE] ${username} | Nivel ${level}`)
        res.json({ ok: true })
    } catch (err) {
        console.error('Error en logDeath:', err)
        res.status(500).json({ error: 'Error interno' })
    }
}

async function completeLevel(req, res) {
    const userId = req.user.id
    const username = req.user.username
    const { level, sessionId, coins } = req.body

    try {
        await upsertStats(userId, { levels_completed: 1 })

        if (sessionId) {
            await pool.execute(
                'UPDATE game_sessions SET completed = TRUE, finished_at = NOW(), coins_collected = ? WHERE id = ?',
                [coins || 0, sessionId]
            )
        }

        console.log(`[${timestamp()}] [NIVEL COMPLETADO] ${username} | Nivel ${level} | Monedas: ${coins}`)
        res.json({ ok: true })
    } catch (err) {
        console.error('Error en completeLevel:', err)
        res.status(500).json({ error: 'Error interno' })
    }
}

async function getStats(req, res) {
    const userId = req.user.id

    try {
        const [stats] = await pool.execute(
            'SELECT * FROM player_stats WHERE user_id = ?',
            [userId]
        )
        const [sessions] = await pool.execute(
            'SELECT * FROM game_sessions WHERE user_id = ? ORDER BY started_at DESC LIMIT 10',
            [userId]
        )
        const [recentCoins] = await pool.execute(
            'SELECT * FROM coin_logs WHERE user_id = ? ORDER BY collected_at DESC LIMIT 20',
            [userId]
        )

        res.json({
            stats: stats[0] || { global_points: 0, total_deaths: 0, total_attempts: 0, levels_completed: 0 },
            sessions,
            recentCoins
        })
    } catch (err) {
        console.error('Error en getStats:', err)
        res.status(500).json({ error: 'Error interno' })
    }
}

module.exports = { startSession, logCoin, logDeath, completeLevel, getStats }

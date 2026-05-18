const mysql = require('mysql2/promise')

const pool = mysql.createPool({
    host: process.env.DB_APP_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_APP_PORT) || 3306,
    user: process.env.DB_APP_USER || 'root',
    password: process.env.DB_APP_PASS || '1004625851',
    database: process.env.DB_APP_NAME || 'gameproject',
    waitForConnections: true,
    connectionLimit: 10,
})

async function initDB() {
    await pool.execute(`
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(50) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `)

    await pool.execute(`
        CREATE TABLE IF NOT EXISTS player_stats (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL UNIQUE,
            global_points INT DEFAULT 0,
            total_deaths INT DEFAULT 0,
            total_attempts INT DEFAULT 0,
            levels_completed INT DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `)

    await pool.execute(`
        CREATE TABLE IF NOT EXISTS game_sessions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            level INT NOT NULL DEFAULT 1,
            attempt INT NOT NULL DEFAULT 1,
            coins_collected INT DEFAULT 0,
            deaths INT DEFAULT 0,
            completed BOOLEAN DEFAULT FALSE,
            started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            finished_at TIMESTAMP NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `)

    await pool.execute(`
        CREATE TABLE IF NOT EXISTS coin_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            session_id INT NULL,
            level INT NOT NULL,
            coin_name VARCHAR(100) NOT NULL,
            collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `)

    console.log('✅ Tablas MySQL listas: users, player_stats, game_sessions, coin_logs')
}

module.exports = { pool, initDB }

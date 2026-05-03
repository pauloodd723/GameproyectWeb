const express = require('express')
const router = express.Router()
const { requireAuth } = require('../middleware/auth')
const { startSession, logCoin, logDeath, completeLevel, getStats } = require('../controllers/gameController')

router.use(requireAuth)

router.post('/session/start', startSession)
router.post('/coin', logCoin)
router.post('/death', logDeath)
router.post('/level-complete', completeLevel)
router.get('/stats', getStats)

module.exports = router

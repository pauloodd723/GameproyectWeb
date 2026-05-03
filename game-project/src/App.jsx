import { useEffect, useRef, useState, useCallback } from 'react'
import Experience from './Experience/Experience'
import LoginScreen from './components/LoginScreen'
import './styles/loader.css'
import './styles/GameUI.css'

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

function formatTime(s) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`
}

const App = () => {
  const canvasRef = useRef()
  const [user, setUser] = useState(null)
  const [checkingSession] = useState(false)

  const [progress, setProgress] = useState(0)
  const [loading, setLoading] = useState(true)
  const [gameActive, setGameActive] = useState(false)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [hud, setHud] = useState({
    points: 0,
    globalPoints: 0,
    deaths: 0,
    time: 0,
    level: 1,
    totalLevels: 4
  })

  const handleLogout = useCallback(async () => {
    await fetch(`${BACKEND}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include'
    }).catch(() => {})
    localStorage.removeItem('gameUsername')
    window.location.reload()
  }, [])

  useEffect(() => {
    if (!user) return

    const experience = new Experience(canvasRef.current)

    const onProgress = (e) => setProgress(e.detail)
    const onComplete = () => setLoading(false)
    const onGameStarted = () => setGameActive(true)
    const onHudPoints = (e) => setHud(h => ({ ...h, points: e.detail }))
    const onHudGlobalPoints = (e) => setHud(h => ({ ...h, globalPoints: e.detail }))
    const onHudDeath = () => setHud(h => ({ ...h, deaths: h.deaths + 1 }))
    const onHudLevel = (e) => setHud(h => ({ ...h, level: e.detail }))

    window.addEventListener('resource-progress', onProgress)
    window.addEventListener('resource-complete', onComplete)
    window.addEventListener('game-started', onGameStarted)
    window.addEventListener('hud-points', onHudPoints)
    window.addEventListener('hud-global-points', onHudGlobalPoints)
    window.addEventListener('hud-death', onHudDeath)
    window.addEventListener('hud-level', onHudLevel)

    return () => {
      window.removeEventListener('resource-progress', onProgress)
      window.removeEventListener('resource-complete', onComplete)
      window.removeEventListener('game-started', onGameStarted)
      window.removeEventListener('hud-points', onHudPoints)
      window.removeEventListener('hud-global-points', onHudGlobalPoints)
      window.removeEventListener('hud-death', onHudDeath)
      window.removeEventListener('hud-level', onHudLevel)
    }
  }, [user])

  useEffect(() => {
    if (!gameActive) return
    const id = setInterval(() => {
      const s = window.experience?.tracker?.getElapsedSeconds?.() ?? 0
      setHud(h => ({ ...h, time: s }))
    }, 1000)
    return () => clearInterval(id)
  }, [gameActive])

  useEffect(() => {
    if (!user) return
    const handler = (e) => {
      if (e.key === 'Escape') setShowExitConfirm(v => !v)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [user])

  if (checkingSession) return null

  if (!user) {
    return <LoginScreen onLogin={setUser} />
  }

  return (
    <>
      {loading && (
        <div id="loader-overlay" role="status" aria-live="polite" aria-label={`Cargando mundo ${progress}%`}>
          <div id="loader-bar" style={{ width: `${progress}%` }} aria-hidden="true"></div>
          <div id="loader-text">Cargando mundo... {progress}%</div>
        </div>
      )}

      <canvas ref={canvasRef} className="webgl" />

      {!loading && (
        <button
          className="exit-btn"
          onClick={() => setShowExitConfirm(true)}
          aria-label="Salir del juego"
        >
          ✕ Salir
        </button>
      )}

      {gameActive && (
        <div
          className="game-hud"
          role="status"
          aria-live="polite"
          aria-label="Estado del juego"
        >
          {/* Nivel */}
          <div className="hud-section hud-level" aria-label={`Nivel ${hud.level} de ${hud.totalLevels}`}>
            <span className="hud-icon" aria-hidden="true">🏁</span>
            <span className="hud-label">Nivel</span>
            <span className="hud-value hud-value--level">
              {hud.level}<span className="hud-total">/{hud.totalLevels}</span>
            </span>
          </div>

          <div className="hud-divider" aria-hidden="true"></div>

          {/* Puntos del nivel */}
          <div className="hud-section" aria-label={`${hud.points} esmeraldas recogidas en este nivel`}>
            <span className="hud-icon" aria-hidden="true">💎</span>
            <span className="hud-label">Nivel</span>
            <span className="hud-value">{hud.points}</span>
          </div>

          {/* Puntos globales */}
          <div className="hud-section hud-global" aria-label={`${hud.globalPoints} esmeraldas totales`}>
            <span className="hud-icon" aria-hidden="true">🌟</span>
            <span className="hud-label">Global</span>
            <span className="hud-value hud-value--global">{hud.globalPoints}</span>
          </div>

          <div className="hud-divider" aria-hidden="true"></div>

          {/* Tiempo */}
          <div className="hud-section" aria-label={`Tiempo transcurrido: ${formatTime(hud.time)}`}>
            <span className="hud-icon" aria-hidden="true">⏱</span>
            <span className="hud-label">Tiempo</span>
            <span className="hud-value">{formatTime(hud.time)}</span>
          </div>

          {/* Muertes */}
          <div className="hud-section hud-deaths" aria-label={`${hud.deaths} muertes`}>
            <span className="hud-icon" aria-hidden="true">💀</span>
            <span className="hud-label">Muertes</span>
            <span className="hud-value hud-value--deaths">{hud.deaths}</span>
          </div>
        </div>
      )}

      {showExitConfirm && (
        <div
          className="exit-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="exit-title"
          onClick={() => setShowExitConfirm(false)}
        >
          <div className="exit-card" onClick={e => e.stopPropagation()}>
            <h3 id="exit-title">Abandonar partida</h3>
            <p>¿Seguro que quieres salir?<br />Perderás el progreso actual.</p>
            <p className="exit-card-hint">También puedes presionar ESC para cerrar esto</p>
            <div className="exit-card-buttons">
              <button className="btn-confirm-exit" onClick={handleLogout}>
                Salir al inicio de sesión
              </button>
              <button className="btn-cancel-exit" onClick={() => setShowExitConfirm(false)}>
                Seguir jugando
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default App

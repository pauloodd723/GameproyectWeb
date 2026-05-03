import gsap from 'gsap'

export default class CircularMenu {
  constructor({ container, vrIntegration, onAudioToggle, onWalkMode, onFullscreen, onCancelGame }) {
    this.container = container
    this.vrIntegration = vrIntegration
    this.isOpen = false
    this.actionButtons = []

    // Estilo base de los botones
    const baseStyle = `
      position: fixed;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: rgba(0, 255, 247, 0.12);
      color: #00fff7;
      font-size: 20px;
      border: 1px solid rgba(0, 255, 247, 0.3);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 10px #00fff7;
      backdrop-filter: blur(4px);
      z-index: 9999;
      transition: all 0.3s ease;
    `

    const hoverStyle = `
      background: rgba(0, 255, 247, 0.25);
      box-shadow: 0 0 15px #00fff7, 0 0 30px #00fff7;
      transform: scale(1.1);
    `

    // Botón flotante principal ⚙️
    this.toggleButton = document.createElement('button')
    this.toggleButton.innerText = '⚙️'
    this.toggleButton.title = 'Mostrar menú'
    this.toggleButton.setAttribute('aria-label', 'Mostrar menú')
    this.toggleButton.style.cssText = baseStyle + 'top: 80px; right: 20px;'
    container.appendChild(this.toggleButton)
    // Ocultar inicialmente
    this.toggleButton.style.display = 'none'
    this.toggleButton.addEventListener('click', () => this.toggleMenu())

    // Lista de botones de acción
    const actions = [
      { icon: '🔊', title: 'Audio', onClick: onAudioToggle },
      { icon: '🚶', title: 'Modo Caminata', onClick: onWalkMode },
      { icon: '🖥️', title: 'Pantalla Completa', onClick: onFullscreen },
      { icon: '🥽', title: 'Modo VR', onClick: () => this.vrIntegration.toggleVR() },
      { icon: '📊', title: 'Mis Estadísticas', onClick: () => this.showStatsModal() },
      { icon: '👨‍💻', title: 'Acerca de', onClick: () => this.showAboutModal() },
      { icon: '❌', title: 'Cancelar Juego', onClick: onCancelGame }
    ]

    actions.forEach((action, index) => {
      const btn = document.createElement('button')
      btn.innerText = action.icon
      btn.title = action.title
      btn.setAttribute('aria-label', action.title)

      Object.assign(btn.style, {
        position: 'fixed',
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        background: 'rgba(0, 255, 247, 0.12)',
        color: '#00fff7',
        fontSize: '20px',
        border: '1px solid rgba(0, 255, 247, 0.3)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 0 10px #00fff7',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        top: `${140 + index * 60}px`,
        right: '20px',
        opacity: '0',
        pointerEvents: 'none'
      })

      btn.addEventListener('click', () => {
        action.onClick()
        this.toggleMenu()
      })

      btn.addEventListener('mouseenter', () => btn.style.cssText += hoverStyle)
      btn.addEventListener('mouseleave', () => btn.style.cssText = btn.style.cssText.replace(hoverStyle, ''))

      this.container.appendChild(btn)
      this.actionButtons.push(btn)
    })

    // Campos internos sin HUD visible (compatibilidad con setStatus/setTimer)
    this.status = { innerText: '' }
    this.timer = { innerText: '' }
    this.playersLabel = { innerText: '' }
  }

  async showStatsModal() {
    if (this.statsContainer) return

    const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

    this.statsContainer = document.createElement('div')
    Object.assign(this.statsContainer.style, {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      background: 'rgba(5, 12, 5, 0.97)',
      padding: '24px 28px',
      borderRadius: '14px',
      color: '#e8ffcc',
      zIndex: 10000,
      textAlign: 'center',
      fontFamily: 'monospace',
      minWidth: '300px',
      maxWidth: '380px',
      border: '2px solid rgba(80,200,60,0.4)',
      boxShadow: '0 0 30px rgba(80,200,60,0.2)'
    })
    this.statsContainer.innerHTML = `<p style="color:#7ef0ff;font-size:1rem;margin:0 0 12px">Cargando estadísticas...</p>`
    document.body.appendChild(this.statsContainer)

    let html = ''
    try {
      const res = await fetch(`${BACKEND}/api/game/stats`, { credentials: 'include' })
      if (!res.ok) throw new Error('No autenticado')
      const data = await res.json()
      const s = data.stats

      const recentCoins = data.recentCoins?.slice(0, 5) || []
      const coinsHtml = recentCoins.length
        ? recentCoins.map(c => `<li style="text-align:left;font-size:0.78rem;color:#a8d090">💎 ${c.coin_name} — Nivel ${c.level} — ${new Date(c.collected_at).toLocaleTimeString()}</li>`).join('')
        : '<li style="color:#666;font-size:0.78rem">Sin monedas aún</li>'

      html = `
        <h2 style="margin:0 0 16px;color:#7ef0ff;font-size:1.1rem">📊 Tus Estadísticas</h2>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
          <div style="background:rgba(80,200,60,0.1);border-radius:8px;padding:10px">
            <div style="font-size:1.6rem;font-weight:700;color:#ffd700">${s.global_points ?? 0}</div>
            <div style="font-size:0.72rem;color:#a8d090">Monedas totales</div>
          </div>
          <div style="background:rgba(80,200,60,0.1);border-radius:8px;padding:10px">
            <div style="font-size:1.6rem;font-weight:700;color:#ff8080">${s.total_deaths ?? 0}</div>
            <div style="font-size:0.72rem;color:#a8d090">Muertes</div>
          </div>
          <div style="background:rgba(80,200,60,0.1);border-radius:8px;padding:10px">
            <div style="font-size:1.6rem;font-weight:700;color:#7ef0ff">${s.total_attempts ?? 0}</div>
            <div style="font-size:0.72rem;color:#a8d090">Intentos</div>
          </div>
          <div style="background:rgba(80,200,60,0.1);border-radius:8px;padding:10px">
            <div style="font-size:1.6rem;font-weight:700;color:#c8e6a0">${s.levels_completed ?? 0}</div>
            <div style="font-size:0.72rem;color:#a8d090">Niveles completados</div>
          </div>
        </div>
        <div style="text-align:left;margin-bottom:16px">
          <div style="font-size:0.8rem;color:#7ef0ff;margin-bottom:6px">Últimas monedas recogidas:</div>
          <ul style="list-style:none;padding:0;margin:0">${coinsHtml}</ul>
        </div>
      `
    } catch (e) {
      html = `<p style="color:#ff8080;font-size:0.9rem">No se pudieron cargar las estadísticas.<br><span style="font-size:0.75rem;color:#666">Verifica que el servidor esté activo.</span></p>`
    }

    this.statsContainer.innerHTML = html + `
      <button style="margin-top:4px;padding:8px 20px;font-size:0.9rem;background:rgba(80,200,60,0.2);color:#c8e6a0;border:1px solid rgba(80,200,60,0.4);border-radius:8px;cursor:pointer;font-family:monospace">Cerrar</button>
    `
    this.statsContainer.querySelector('button').onclick = () => {
      this.statsContainer?.remove()
      this.statsContainer = null
    }
  }

  //Mostrar modal acerca de
  showAboutModal() {
    if (this.aboutContainer) return // evita duplicados

    this.aboutContainer = document.createElement('div')
    Object.assign(this.aboutContainer.style, {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      background: 'rgba(0, 0, 0, 0.95)',
      padding: '20px',
      borderRadius: '12px',
      color: '#fff',
      zIndex: 10000,
      textAlign: 'center',
      fontFamily: 'sans-serif',
      maxWidth: '300px',
      boxShadow: '0 0 20px #00fff7'
    })

    this.aboutContainer.innerHTML = `
          <h2 style="margin-bottom: 10px;">👨‍💻 Desarrollador</h2>
          <p style="margin: 0;">Gustavo Sánchez Rodríguez</p>
          <p style="margin: 0; font-size: 14px;">Universidad Cooperativa de Colombia</p>
          <p style="margin: 10px 0 0; font-size: 13px;">Proyecto interactivo educativo con Three.js</p>
          <p style="margin: 10px 0 0; font-size: 13px;">guswillsan@gmail.com</p>
          <button style="
            margin-top: 12px;
            padding: 6px 14px;
            font-size: 14px;
            background: #00fff7;
            color: black;
            border: none;
            border-radius: 6px;
            cursor: pointer;
          ">Cerrar</button>
        `

    const closeBtn = this.aboutContainer.querySelector('button')
    closeBtn.onclick = () => {
      this.aboutContainer.remove()
      this.aboutContainer = null
    }

    document.body.appendChild(this.aboutContainer)
  }




  toggleMenu() {
    this.isOpen = !this.isOpen

    this.actionButtons.forEach((btn, index) => {
      const delay = index * 0.05
      if (this.isOpen) {
        gsap.to(btn, {
          opacity: 1,
          y: 0,
          pointerEvents: 'auto',
          delay,
          duration: 0.3,
          ease: 'power2.out'
        })
      } else {
        gsap.to(btn, {
          opacity: 0,
          y: -10,
          pointerEvents: 'none',
          delay,
          duration: 0.2,
          ease: 'power2.in'
        })
      }
    })
  }

  setStatus(text) {
    if (this.status) this.status.innerText = text
  }

  setTimer(seconds) {
    if (this.timer) this.timer.innerText = `⏱ ${seconds}s`
  }

  //Contador jugadores
  setPlayerCount(count) {
    if (this.playersLabel) {
      this.playersLabel.innerText = `👥 Jugadores: ${count}`
    }
  }


  destroy() {
    this.toggleButton?.remove()
    this.actionButtons?.forEach(btn => btn.remove())
    this.statsContainer?.remove()
    this.aboutContainer?.remove()
  }
}

import * as THREE from 'three'

// ─── Carteles al lado de las gemas (coordenadas sacadas de toy_car_blocks.json) ───
// Gema default → cartel a +3 en Z y +3.2 en Y respecto a la gema
// rotY = Math.PI → el cartel mira hacia -Z (jugador lo ve al acercarse desde el sur)
const LEVEL_SIGNS = {
    1: [
        // Gema 1 → coin_structure_detailed_lev1  x=24.9  z=1.9
        {
            pos: { x: 24.9, y: 4.5, z: 4.5 },
            rotY: Math.PI,
            icon: '💎', title: 'RECOGE ESMERALDAS',
            lines: ['Junta 2 gemas para activar', 'el portal de salida'],
            titleColor: '#50ff80', borderColor: '#28aa44'
        },
        // Gema 2 → coin_structure_detailed.001_lev1  x=-4.0  z=-37.6
        {
            pos: { x: -4.0, y: 4.5, z: -35 },
            rotY: Math.PI,
            icon: '🧟', title: '¡ZOMBIES CERCA!',
            lines: ['Mantente en movimiento', 'No dejes que te atrapen'],
            titleColor: '#ff6644', borderColor: '#cc2200'
        }
    ],
    2: [
        // Gema 1 → coin_structure_detailed_lev2  x=24.9  z=1.9
        {
            pos: { x: 24.9, y: 4.5, z: 4.5 },
            rotY: Math.PI,
            icon: '⚠️', title: 'ZONA PELIGROSA',
            lines: ['3 zombies patrullan', 'esta área — ¡Cuidado!'],
            titleColor: '#ffcc44', borderColor: '#cc8800'
        },
        // Gema 2 → coin_structure_detailed.001_lev2  x=-4.0  z=-37.6
        {
            pos: { x: -4.0, y: 4.5, z: -35 },
            rotY: Math.PI,
            icon: '🏃', title: 'CONSEJO PRO',
            lines: ['Mantén Shift pulsado', 'para correr más rápido'],
            titleColor: '#44bbff', borderColor: '#0077cc'
        }
    ],
    3: [
        // Gema 1 → coin_structure_detailed_lev3  x=30.6  z=23.5
        {
            pos: { x: 30.6, y: 4.5, z: 26.2 },
            rotY: Math.PI,
            icon: '💀', title: 'SOLO LOS VALIENTES',
            lines: ['5 zombies te persiguen', 'Recoge 4 esmeraldas'],
            titleColor: '#cc66ff', borderColor: '#8800cc'
        },
        // Gema 2 → coin_structure_detailed.001_lev3  x=-37.0  z=23.2
        {
            pos: { x: -37.0, y: 4.5, z: 25.8 },
            rotY: Math.PI,
            icon: '🌟', title: 'PUNTOS GLOBALES',
            lines: ['Cada gema suma a tu', 'récord de supervivencia'],
            titleColor: '#ffd700', borderColor: '#aa7700'
        }
    ],
    4: [
        // Gema 1 → coin_structure_detailed_lev4  x=122.4  y=1.8  z=-111.9
        {
            pos: { x: 122.4, y: 5, z: -109.2 },
            rotY: Math.PI,
            icon: '🔥', title: 'PENÚLTIMO NIVEL',
            lines: ['7 zombies más veloces', '¡No te confíes!'],
            titleColor: '#ff7733', borderColor: '#cc3300'
        },
        // Gema 2 → coin_structure_detailed.002_lev4  x=43.7  y=3.0  z=40.8
        {
            pos: { x: 43.7, y: 6.5, z: 43.5 },
            rotY: Math.PI,
            icon: '🗺️', title: 'NIVEL ENORME',
            lines: ['Explora todo el mapa', '4 gemas esperan por ti'],
            titleColor: '#88ff44', borderColor: '#44aa00'
        }
    ],
    5: [
        // Gema 1 → coin_structure_detailed.002_lev5  x=23.7  z=23.8
        {
            pos: { x: 23.7, y: 4.5, z: 26.5 },
            rotY: Math.PI,
            icon: '🏆', title: 'NIVEL FINAL',
            lines: ['10 zombies te esperan', '¿Tienes el coraje?'],
            titleColor: '#ffd700', borderColor: '#aa8800'
        },
        // Gema 2 → coin_structure_detailed.001_lev5  x=-23.8  z=24.6
        {
            pos: { x: -23.8, y: 4.5, z: 27.3 },
            rotY: Math.PI,
            icon: '⭐', title: 'ÚLTIMO DESAFÍO',
            lines: ['Recoge 4 esmeraldas y', 'habrás sobrevivido todo'],
            titleColor: '#ff88ff', borderColor: '#880088'
        }
    ]
}

function buildTexture(cfg) {
    const W = 512, H = 256
    const cv = document.createElement('canvas')
    cv.width = W
    cv.height = H
    const ctx = cv.getContext('2d')

    // Fondo
    const bg = ctx.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0, '#0c150c')
    bg.addColorStop(1, '#060a06')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    // Borde exterior
    ctx.strokeStyle = cfg.borderColor
    ctx.lineWidth = 7
    ctx.strokeRect(3.5, 3.5, W - 7, H - 7)

    // Borde interior fino
    ctx.strokeStyle = cfg.titleColor
    ctx.lineWidth = 1
    ctx.globalAlpha = 0.3
    ctx.strokeRect(14, 14, W - 28, H - 28)
    ctx.globalAlpha = 1

    // Cuadrados en esquinas
    const cs = 14
    ctx.fillStyle = cfg.borderColor
    for (const [cx, cy] of [[4, 4], [W - 4 - cs, 4], [4, H - 4 - cs], [W - 4 - cs, H - 4 - cs]]) {
        ctx.fillRect(cx, cy, cs, cs)
    }

    // Círculo de fondo del icono
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.beginPath()
    ctx.arc(70, H / 2 - 6, 46, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = cfg.borderColor
    ctx.lineWidth = 2.5
    ctx.stroke()

    // Emoji
    ctx.font = '50px serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(cfg.icon, 70, H / 2 - 6)

    // Divisor vertical
    ctx.strokeStyle = cfg.borderColor
    ctx.lineWidth = 1
    ctx.globalAlpha = 0.35
    ctx.beginPath()
    ctx.moveTo(130, 22)
    ctx.lineTo(130, H - 22)
    ctx.stroke()
    ctx.globalAlpha = 1

    // Título con glow
    ctx.font = 'bold 26px "Courier New", monospace'
    ctx.fillStyle = cfg.titleColor
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.shadowColor = cfg.titleColor
    ctx.shadowBlur = 8
    ctx.fillText(cfg.title, 146, 34)
    ctx.shadowBlur = 0

    // Línea bajo el título
    const tw = ctx.measureText(cfg.title).width
    ctx.fillStyle = cfg.borderColor
    ctx.globalAlpha = 0.6
    ctx.fillRect(146, 67, Math.min(tw, W - 162), 2)
    ctx.globalAlpha = 1

    // Texto descriptivo
    ctx.font = '20px "Courier New", monospace'
    ctx.fillStyle = 'rgba(210, 240, 185, 0.9)'
    ctx.textBaseline = 'top'
    cfg.lines.forEach((line, i) => ctx.fillText(line, 146, 80 + i * 28))

    // Marca del juego
    ctx.font = '12px monospace'
    ctx.fillStyle = 'rgba(120, 180, 80, 0.28)'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'bottom'
    ctx.fillText('GEM SURVIVAL RUN', W - 16, H - 12)

    return new THREE.CanvasTexture(cv)
}

export default class BillboardSystem {
    constructor(scene) {
        this.scene = scene
        this._items = []
    }

    create(level) {
        this.dispose()
        const signs = LEVEL_SIGNS[level]
        if (!signs) return

        signs.forEach(cfg => {
            const tex = buildTexture(cfg)

            // Panel (DoubleSide: visible desde los dos lados)
            const panel = new THREE.Mesh(
                new THREE.PlaneGeometry(4.5, 2.25),
                new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })
            )
            panel.position.set(cfg.pos.x, cfg.pos.y, cfg.pos.z)
            panel.rotation.y = cfg.rotY
            panel.userData.levelObject = true
            this.scene.add(panel)
            this._items.push({ mesh: panel, tex })

            // Poste de soporte
            const poleH = cfg.pos.y - 0.5
            const pole = new THREE.Mesh(
                new THREE.CylinderGeometry(0.07, 0.1, poleH, 8),
                new THREE.MeshBasicMaterial({ color: 0x1a2a1a })
            )
            pole.position.set(cfg.pos.x, poleH / 2, cfg.pos.z)
            pole.userData.levelObject = true
            this.scene.add(pole)
            this._items.push({ mesh: pole, tex: null })
        })

        console.log(`[Billboards] Nivel ${level}: 2 carteles creados`)
    }

    dispose() {
        this._items.forEach(({ mesh, tex }) => {
            mesh.geometry?.dispose()
            mesh.material?.dispose()
            tex?.dispose()
            this.scene.remove(mesh)
        })
        this._items = []
    }
}

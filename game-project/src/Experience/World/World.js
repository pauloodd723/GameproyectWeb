import * as THREE from 'three'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import Environment from './Environment.js'
import Fox from './Fox.js'
import Robot from './Robot.js'
import ToyCarLoader from '../../loaders/ToyCarLoader.js'
import Floor from './Floor.js'
import ThirdPersonCamera from './ThirdPersonCamera.js'
import Sound from './Sound.js'
import AmbientSound from './AmbientSound.js'
import MobileControls from '../../controls/MobileControls.js'
import LevelManager from './LevelManager.js';
import BlockPrefab from './BlockPrefab.js'
import FinalPrizeParticles from '../Utils/FinalPrizeParticles.js'
import Enemy from './Enemy.js'

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

async function gameAPI(path, body) {
    try {
        await fetch(`${BACKEND}/api/game${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(body)
        })
    } catch (e) {
        console.warn(`[API] Error en ${path}:`, e.message)
    }
}

export default class World {
    constructor(experience) {
        this.experience = experience
        this.scene = this.experience.scene
        this.blockPrefab = new BlockPrefab(this.experience)
        this.resources = this.experience.resources
        this.levelManager = new LevelManager(this.experience);
        this.finalPrizeActivated = false
        this.gameStarted = false
        this.enemies = []
        this.globalPoints = 0
        this.sessionId = null

        this.coinSound = new Sound('/sounds/coin.ogg')
        this.ambientSound = new AmbientSound('/sounds/ambiente.mp3')
        this.winner = new Sound('/sounds/winner.mp3')
        this.portalSound = new Sound('/sounds/portal.mp3')
        this.loseSound = new Sound('/sounds/lose.ogg')

        this.currentSpawnPoint = { x: -17, y: 1.5, z: -67 }
        this.allowPrizePickup = false
        this.hasMoved = false

        setTimeout(() => { this.allowPrizePickup = true }, 2000)

        this.resources.on('ready', async () => {
            try {
                const res = await fetch(`${BACKEND}/api/game/session/start`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ level: 1 })
                })
                if (res.ok) {
                    const data = await res.json()
                    this.sessionId = data.sessionId
                }
            } catch (e) { console.warn('[API] No se pudo registrar sesión:', e.message) }

            try {
                const res = await fetch(`${BACKEND}/api/game/stats`, { credentials: 'include' })
                if (res.ok) {
                    const data = await res.json()
                    this.globalPoints = data.stats?.global_points || 0
                    window.dispatchEvent(new CustomEvent('hud-global-points', { detail: this.globalPoints }))
                }
            } catch (e) {}

            this.floor = new Floor(this.experience)
            this.environment = new Environment(this.experience)
            this.loader = new ToyCarLoader(this.experience)
            await this.loader.loadFromAPI()
            this.fox = new Fox(this.experience)
            this.robot = new Robot(this.experience)

            const nivel = this.levelManager?.currentLevel || 1
            const zombiesPorNivel = { 1: 2, 2: 3, 3: 5, 4: 7, 5: 10 }
            this.spawnEnemies(zombiesPorNivel[nivel] || 3)

            this.experience.vr.bindCharacter(this.robot)
            this.thirdPersonCamera = new ThirdPersonCamera(this.experience, this.robot.group)

            this.mobileControls = new MobileControls({
                onUp: (pressed) => { this.experience.keyboard.keys.up = pressed },
                onDown: (pressed) => { this.experience.keyboard.keys.down = pressed },
                onLeft: (pressed) => { this.experience.keyboard.keys.left = pressed },
                onRight: (pressed) => { this.experience.keyboard.keys.right = pressed }
            })

            if (!this.experience.physics || !this.experience.physics.world) {
                console.error("🚫 Sistema de físicas no está inicializado al cargar el mundo.")
                return
            }

            this._checkVRMode()
            this.experience.renderer.instance.xr.addEventListener('sessionstart', () => { this._checkVRMode() })
        })
    }

    triggerDefeat() {
        if (this.defeatTriggered) return
        this.defeatTriggered = true
        this.robot?.die()
        window.dispatchEvent(new CustomEvent('hud-death'))
        gameAPI('/death', { level: this.levelManager.currentLevel, sessionId: this.sessionId })
        if (window.userInteracted && this.loseSound) this.loseSound.play()

        const overlay = document.createElement('div')
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.88);display:flex;align-items:center;justify-content:center;z-index:9999;'
        overlay.innerHTML = `
            <div style="background:linear-gradient(135deg,#1a0000,#2d0000,#1a0000);border:2px solid #ff2200;border-radius:16px;padding:40px 48px;text-align:center;max-width:420px;width:90%;box-shadow:0 0 40px #ff220066;">
                <div style="font-size:72px;margin-bottom:16px;">☠️</div>
                <h2 style="font-size:26px;font-weight:900;color:#ff4422;text-shadow:0 0 20px #ff2200;margin:0 0 8px;letter-spacing:2px;text-transform:uppercase;">¡Te atraparon!</h2>
                <p style="color:rgba(255,255,255,0.75);font-size:15px;margin:0 0 28px;line-height:1.6;">Los zombies acabaron contigo.<br/>¿Tienes el valor de intentarlo otra vez?</p>
                <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
                    <button id="btn-retry-defeat" style="background:linear-gradient(135deg,#00cc44,#008833);color:white;border:none;border-radius:8px;padding:12px 28px;font-size:16px;font-weight:700;cursor:pointer;">🔁 Reintentar</button>
                    <button id="btn-quit-defeat" style="background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.7);border:1px solid rgba(255,255,255,0.2);border-radius:8px;padding:12px 28px;font-size:16px;cursor:pointer;">❌ Salir</button>
                </div>
            </div>
        `
        document.body.appendChild(overlay)

        document.getElementById('btn-retry-defeat').onclick = () => {
            overlay.remove()
            this.defeatTriggered = false
            this.gameStarted = true
            const spawn = this.levelManager.spawnPoints?.[this.levelManager.currentLevel] || { x: -17, y: 1.5, z: -67 }
            this.robot?.reset?.()
            this.resetRobotPosition(spawn)
            const zombiesPorNivel = { 1: 2, 2: 3, 3: 5, 4: 7, 5: 10 }
            const count = zombiesPorNivel[this.levelManager.currentLevel] || 3
            this.spawnEnemies(count)
        }
        document.getElementById('btn-quit-defeat').onclick = () => {
            overlay.remove()
            // ✅ Volver al login
            window.location.reload()
        }
    }

    spawnEnemies(count = 3) {
        if (!this.robot?.body?.position) return
        const playerPos = this.robot.body.position
        console.log('[spawnEnemies] Posición del jugador:', playerPos.x.toFixed(1), playerPos.y.toFixed(1), playerPos.z.toFixed(1))

        if (this.enemies?.length) {
            this.enemies.forEach(e => e?.destroy?.())
            this.enemies = []
        }

        const zombieGlb = this.resources?.items?.zombieModel
        console.log('[spawnEnemies] zombieModel cargado:', !!zombieGlb, '| scene:', !!zombieGlb?.scene)
        const useZombie = !!(zombieGlb?.scene)

        // ✅ Radio según nivel — nivel 4 interior más pequeño
        const nivelActual = this.levelManager?.currentLevel || 1
        const minRadius = nivelActual === 4 ? 8 : 25
        const maxRadius = nivelActual === 4 ? 15 : 40

        // ✅ Delay según nivel — nivel 4 tiene 5s para que cargue bien
        const delaySegundos = nivelActual === 4 ? 5.0 : 3.0

        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2
            const radius = minRadius + Math.random() * (maxRadius - minRadius)
            const x = playerPos.x + Math.cos(angle) * radius
            const z = playerPos.z + Math.sin(angle) * radius
            const y = 1.5

            console.log(`[spawnEnemies] Enemigo ${i} spawn:`, x.toFixed(1), y.toFixed(1), z.toFixed(1))

            let modelClone
            if (useZombie) {
                modelClone = SkeletonUtils.clone(zombieGlb.scene)
                const bbox = new THREE.Box3().setFromObject(modelClone)
                if (!bbox.isEmpty()) {
                    const s = new THREE.Vector3()
                    bbox.getSize(s)
                    const maxDim = Math.max(s.x, s.y, s.z)
                    if (maxDim > 0) modelClone.scale.multiplyScalar(1 / maxDim)
                }
                modelClone.traverse(child => {
                    if (child.isMesh || child.isSkinnedMesh) {
                        child.castShadow = true
                        child.visible = true
                        child.frustumCulled = false
                    }
                })
            } else {
                modelClone = new THREE.Mesh(
                    new THREE.BoxGeometry(1, 1, 1),
                    new THREE.MeshStandardMaterial({ color: 0xff0000 })
                )
            }

            const enemy = new Enemy({
                scene: this.scene,
                physicsWorld: this.experience.physics.world,
                playerRef: this.robot,
                model: modelClone,
                position: new THREE.Vector3(x, y, z),
                experience: this.experience,
                zombieGlb: useZombie ? zombieGlb : null
            })

            enemy.delayActivation = delaySegundos
            this.enemies.push(enemy)
        }

        console.log('[spawnEnemies] Total enemigos creados:', this.enemies.length)
    }

    toggleAudio() { this.ambientSound.toggle() }

    update(delta) {
        this.fox?.update()
        this.robot?.update()
        this.blockPrefab?.update()

        this.enemies?.forEach(e => e.update(delta, this.gameStarted))

        if (this.gameStarted) {
            const distToClosest = this.enemies?.reduce((min, e) => {
                if (!e?.body?.position || !this.robot?.body?.position) return min
                const d = e.body.position.distanceTo(this.robot.body.position)
                return Math.min(min, d)
            }, Infinity) ?? Infinity

            if (distToClosest < 1.0 && !this.defeatTriggered) {
                this.triggerDefeat()
                return
            }
        }

        if (this.thirdPersonCamera && this.experience.isThirdPerson && !this.experience.renderer.instance.xr.isPresenting) {
            this.thirdPersonCamera.update()
        }

        this.loader?.prizes?.forEach(p => p.update(delta))

        if (!this.allowPrizePickup || !this.loader || !this.robot || !this.robot.body) return

        let pos = null
        if (this.experience.renderer.instance.xr.isPresenting) {
            pos = this.experience.camera.instance.position
        } else if (this.robot?.body?.position) {
            pos = this.robot.body.position
        } else {
            return
        }

        const speed = this.robot?.body?.velocity?.length?.() || 0
        const moved = speed > 0.5

        this.loader.prizes.forEach((prize) => {
            if (!prize.pivot) return
            const dist = prize.pivot.position.distanceTo(pos)
            if (dist < 1.2 && moved && !prize.collected) {
                prize.collect()
                prize.collected = true

                if (prize.role === "default") {
                    this.points = (this.points || 0) + 1
                    this.robot.points = this.points
                    window.dispatchEvent(new CustomEvent('hud-points', { detail: this.points }))

                    fetch(`${BACKEND}/api/game/coin`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ level: this.levelManager.currentLevel, coinName: prize.name || prize.role, sessionId: this.sessionId })
                    }).then(r => r.ok ? r.json() : null).then(data => {
                        if (data?.globalPoints !== undefined) {
                            this.globalPoints = data.globalPoints
                            window.dispatchEvent(new CustomEvent('hud-global-points', { detail: this.globalPoints }))
                        }
                    }).catch(() => {})

                    const pointsTarget = this.levelManager.getCurrentLevelTargetPoints()
                    console.log(`🎯 Monedas recolectadas: ${this.points} / ${pointsTarget}`)

                    if (!this.finalPrizeActivated && this.points === pointsTarget) {
                        const finalCoin = this.loader.prizes.find(p => p.role === "finalPrize")
                        if (finalCoin && !finalCoin.collected && finalCoin.pivot) {
                            finalCoin.pivot.visible = true
                            if (finalCoin.model) finalCoin.model.visible = true
                            this.finalPrizeActivated = true
                            new FinalPrizeParticles({ scene: this.scene, targetPosition: finalCoin.pivot.position, sourcePosition: this.robot.body.position, experience: this.experience })
                            this._createFinalPrizeBeam(finalCoin.pivot.position)
                            if (window.userInteracted) this.portalSound.play()
                            console.log("🪙 Coin final activado correctamente.")
                        }
                    }
                }

                if (prize.role === "finalPrize") {
                    if (this.levelManager.currentLevel < this.levelManager.totalLevels) {
                        gameAPI('/level-complete', { level: this.levelManager.currentLevel, sessionId: this.sessionId, coins: this.points })
                        this.levelManager.nextLevel()
                        this.points = 0
                        this.robot.points = 0
                        window.dispatchEvent(new CustomEvent('hud-points', { detail: 0 }))
                        window.dispatchEvent(new CustomEvent('hud-level', { detail: this.levelManager.currentLevel }))
                        setTimeout(() => {
                            const zombiesPorNivel = { 1: 2, 2: 3, 3: 5, 4: 7, 5: 10 }
                            const count = zombiesPorNivel[this.levelManager.currentLevel] || 3
                            this.spawnEnemies(count)
                        }, 1500)
                    } else {
                        const elapsed = this.experience.tracker.stop()
                        this.experience.tracker.saveTime(elapsed)
                        this.experience.tracker.showEndGameModal(elapsed)
                        this.experience.obstacleWavesDisabled = true
                        clearTimeout(this.experience.obstacleWaveTimeout)
                        this.experience.raycaster?.removeAllObstacles()
                        if (window.userInteracted) this.winner.play()
                        // ✅ Detener zombies al ganar
                        this.gameStarted = false
                        this.enemies?.forEach(e => { if (e.body) { e.body.velocity.set(0,0,0) } })
                    }
                }
                if (window.userInteracted) this.coinSound.play()
                this.experience.menu.setStatus?.(`🎖️ Puntos: ${this.points}`)
            }
        })

        if (!this.finalPrizeActivated && this.loader?.prizes) {
            const totalDefault = this.loader.prizes.filter(p => p.role === 'default').length
            const collectedDefault = this.loader.prizes.filter(p => p.role === 'default' && p.collected).length
            if (totalDefault > 0 && collectedDefault === totalDefault) {
                const finalCoin = this.loader.prizes.find(p => p.role === "finalPrize")
                if (finalCoin && !finalCoin.collected && finalCoin.pivot) {
                    finalCoin.pivot.visible = true
                    if (finalCoin.model) finalCoin.model.visible = true
                    this.finalPrizeActivated = true
                    new FinalPrizeParticles({ scene: this.scene, targetPosition: finalCoin.pivot.position, sourcePosition: this.experience.vrDolly?.position ?? this.experience.camera.instance.position, experience: this.experience })
                    this._createFinalPrizeBeam(finalCoin.pivot.position)
                    if (window.userInteracted) this.portalSound.play()
                }
            }
        }

        // ✅ Animar portal rojo/naranja estilo zombie
        const _t = Date.now() * 0.001
        if (this._ring1) { this._ring1.rotation.z = _t * 1.0 }
        if (this._ring2) { this._ring2.rotation.z = -_t * 1.6 }
        if (this._ring3) { this._ring3.rotation.z = _t * 2.4 }
        if (this._disc) { this._disc.material.opacity = 0.8 + Math.sin(_t*3)*0.2 }
        if (this._particles) { this._particles.rotation.y = _t * 0.5 }
        if (this._particles2) { this._particles2.rotation.y = -_t * 0.3 }
        if (this._particles) { this._particles.rotation.y = _t * 0.25 }
        if (this.finalPrizeBeam) { this.finalPrizeBeam.material.opacity = 0.1 + Math.sin(_t * 2) * 0.06 }
        if (this.finalPrizeBeamLight) { this.finalPrizeBeamLight.intensity = 4 + Math.sin(_t * 3) * 2 }

        const playerPos = this.experience.renderer.instance.xr.isPresenting
            ? this.experience.camera.instance.position
            : this.robot?.body?.position

        this.scene.traverse((obj) => {
            if (obj.userData?.levelObject && obj.userData.physicsBody) {
                const dist = obj.position.distanceTo(playerPos)
                const shouldEnable = dist < 40 && obj.visible
                const body = obj.userData.physicsBody
                if (shouldEnable && !body.enabled) body.enabled = true
                else if (!shouldEnable && body.enabled) body.enabled = false
            }
        })
    }

    async loadLevel(level) {
        try {
            const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'
            const apiUrl = `${backendUrl}/api/blocks?level=${level}`
            let data
            try {
                const res = await fetch(apiUrl)
                if (!res.ok) throw new Error('Error desde API')
                const ct = res.headers.get('content-type') || ''
                if (!ct.includes('application/json')) throw new Error('No JSON')
                data = await res.json()
            } catch (error) {
                console.warn(`⚠️ Usando datos locales para nivel ${level}...`)
                const publicPath = (p) => { const base = import.meta.env.BASE_URL || '/'; return `${base.replace(/\/$/, '')}/${p.replace(/^\//, '')}` }
                const localRes = await fetch(publicPath('data/toy_car_blocks.json'))
                if (!localRes.ok) throw new Error(`No se pudo cargar toy_car_blocks.json`)
                const allBlocks = await localRes.json()
                data = {
                    blocks: allBlocks.filter(b => b.level === level),
                    spawnPoint: this.levelManager.spawnPoints[level] || { x: -17, y: 1.5, z: -67 }
                }
            }

            const spawnPoint = data.spawnPoint || this.levelManager.spawnPoints[level] || { x: -17, y: 1.5, z: -67 }
            this.currentSpawnPoint = spawnPoint
            this.points = 0
            this.robot.points = 0
            this.finalPrizeActivated = false
            window.dispatchEvent(new CustomEvent('hud-level', { detail: level }))
            this.experience.menu.setStatus?.(`🎖️ Puntos: ${this.points}`)

            if (data.blocks) {
                const publicPath = (p) => { const base = import.meta.env.BASE_URL || '/'; return `${base.replace(/\/$/, '')}/${p.replace(/^\//, '')}` }
                const preciseRes = await fetch(publicPath('config/precisePhysicsModels.json'))
                if (!preciseRes.ok) throw new Error('No precisePhysicsModels')
                const preciseModels = await preciseRes.json()
                this.loader._processBlocks(data.blocks, preciseModels)
            } else {
                await this.loader.loadFromURL(apiUrl)
            }

            this.loader.prizes.forEach(p => {
                if (p.model) p.model.visible = (p.role !== 'finalPrize')
                p.collected = false
            })

            this.totalDefaultCoins = this.loader.prizes.filter(p => p.role === "default").length
            console.log(`🎯 Total de monedas default para el nivel ${level}: ${this.totalDefaultCoins}`)
            this.resetRobotPosition(spawnPoint)
            console.log(`✅ Nivel ${level} cargado con spawn en`, spawnPoint)
        } catch (error) {
            console.error('❌ Error cargando nivel:', error)
        }
    }

    clearCurrentScene() {
        if (!this.experience || !this.scene || !this.experience.physics?.world) {
            console.warn('⚠️ No se puede limpiar: sistema de físicas no disponible.')
            return
        }

        const childrenToRemove = []
        this.scene.children.forEach((child) => { if (child.userData?.levelObject) childrenToRemove.push(child) })
        childrenToRemove.forEach((child) => {
            child.geometry?.dispose()
            if (child.material) { Array.isArray(child.material) ? child.material.forEach(m => m.dispose()) : child.material.dispose() }
            this.scene.remove(child)
            if (child.userData.physicsBody) this.experience.physics.world.removeBody(child.userData.physicsBody)
        })

        if (Array.isArray(this.experience.physics.bodies)) {
            const surviving = []
            this.experience.physics.bodies.forEach((body) => {
                if (body.userData?.levelObject) { this.experience.physics.world.removeBody(body) }
                else { surviving.push(body) }
            })
            this.experience.physics.bodies = surviving
        }

        if (this.loader?.prizes?.length) {
            this.loader.prizes.forEach(prize => {
                if (prize.pivot) {
                    prize.pivot.traverse(child => {
                        child.geometry?.dispose()
                        if (child.material) { Array.isArray(child.material) ? child.material.forEach(m => m.dispose()) : child.material.dispose() }
                    })
                    this.scene.remove(prize.pivot)
                }
            })
            this.loader.prizes = []
        }

        this.finalPrizeActivated = false

        if (this._portalGroup) { this.scene.remove(this._portalGroup); this._portalGroup = null; this._ring1 = null; this._ring2 = null; this._ring3 = null; this._particles = null; this._particles2 = null; this._disc = null }
        if (this.finalPrizeBeam) { this.finalPrizeBeam.geometry.dispose(); this.finalPrizeBeam.material.dispose(); this.scene.remove(this.finalPrizeBeam); this.finalPrizeBeam = null }
        if (this.finalPrizeBeamLight) { this.scene.remove(this.finalPrizeBeamLight); this.finalPrizeBeamLight = null }
    }

    resetRobotPosition(spawn = { x: -17, y: 1.5, z: -67 }) {
        if (!this.robot?.body || !this.robot?.group) return
        this.robot.body.position.set(spawn.x, spawn.y, spawn.z)
        this.robot.body.velocity.set(0, 0, 0)
        this.robot.body.angularVelocity.set(0, 0, 0)
        this.robot.body.quaternion.setFromEuler(0, 0, 0)
        this.robot.group.position.set(spawn.x, spawn.y, spawn.z)
        this.robot.group.rotation.set(0, 0, 0)
    }

    async _processLocalBlocks(blocks) {
        const preciseRes = await fetch('/config/precisePhysicsModels.json')
        const preciseModels = await preciseRes.json()
        this.loader._processBlocks(blocks, preciseModels)
        this.loader.prizes.forEach(p => { if (p.model) p.model.visible = (p.role !== 'finalPrize'); p.collected = false })
        this.totalDefaultCoins = this.loader.prizes.filter(p => p.role === "default").length
    }

    _createFinalPrizeBeam(position) {
        // ✅ Portal verde — esfera + anillos giratorios + partículas
        this._portalGroup = new THREE.Group()
        this._portalGroup.position.set(position.x, position.y + 0.3, position.z)
        this.scene.add(this._portalGroup)

        // Esfera central verde brillante
        this._disc = new THREE.Mesh(
            new THREE.SphereGeometry(0.9, 32, 32),
            new THREE.MeshBasicMaterial({ color: 0x00cc44, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending })
        )
        this._portalGroup.add(this._disc)

        // Anillo exterior verde
        this._ring1 = new THREE.Mesh(
            new THREE.TorusGeometry(1.3, 0.07, 8, 48),
            new THREE.MeshBasicMaterial({ color: 0x00ff55, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending })
        )
        this._portalGroup.add(this._ring1)

        // Anillo medio
        this._ring2 = new THREE.Mesh(
            new THREE.TorusGeometry(0.95, 0.05, 8, 48),
            new THREE.MeshBasicMaterial({ color: 0x88ffcc, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending })
        )
        this._portalGroup.add(this._ring2)

        // Anillo interior
        this._ring3 = new THREE.Mesh(
            new THREE.TorusGeometry(0.5, 0.04, 8, 48),
            new THREE.MeshBasicMaterial({ color: 0xaaffdd, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending })
        )
        this._portalGroup.add(this._ring3)

        // Partículas en espiral
        const pCount = 120
        const pGeo = new THREE.BufferGeometry()
        const pPos = new Float32Array(pCount * 3)
        for (let i = 0; i < pCount; i++) {
            const t = i / pCount
            const a = t * Math.PI * 8
            const r = 0.1 + t * 1.2
            pPos[i*3]   = Math.cos(a) * r
            pPos[i*3+1] = (t - 0.5) * 2.5
            pPos[i*3+2] = Math.sin(a) * r
        }
        pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3))
        this._particles = new THREE.Points(pGeo, new THREE.PointsMaterial({
            color: 0x00ff88, size: 0.07, transparent: true, opacity: 0.85,
            depthWrite: false, blending: THREE.AdditiveBlending
        }))
        this._portalGroup.add(this._particles)

        // Partículas flotantes extras
        const p2Geo = new THREE.BufferGeometry()
        const p2Pos = new Float32Array(50 * 3)
        for (let i = 0; i < 50; i++) {
            const a = Math.random() * Math.PI * 2
            const r = 0.3 + Math.random() * 1.4
            p2Pos[i*3]   = Math.cos(a) * r
            p2Pos[i*3+1] = (Math.random()-0.5) * 2.5
            p2Pos[i*3+2] = Math.sin(a) * r
        }
        p2Geo.setAttribute('position', new THREE.BufferAttribute(p2Pos, 3))
        this._particles2 = new THREE.Points(p2Geo, new THREE.PointsMaterial({
            color: 0xaaffcc, size: 0.06, transparent: true, opacity: 0.7,
            depthWrite: false, blending: THREE.AdditiveBlending
        }))
        this._portalGroup.add(this._particles2)

        // Luz verde pulsante
        this.finalPrizeBeamLight = new THREE.PointLight(0x00ff44, 6, 14)
        this.finalPrizeBeamLight.position.set(position.x, position.y+1.5, position.z)
        this.scene.add(this.finalPrizeBeamLight)

        // Rayo vertical
        this.finalPrizeBeam = new THREE.Mesh(
            new THREE.CylinderGeometry(0.02, 0.4, 22, 6, 1, true),
            new THREE.MeshBasicMaterial({ color: 0x00ff44, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
        )
        this.finalPrizeBeam.position.set(position.x, position.y+12, position.z)
        this.scene.add(this.finalPrizeBeam)
    }
    _checkVRMode() {
        const isVR = this.experience.renderer.instance.xr.isPresenting
        if (isVR) {
            if (this.robot?.group) this.robot.group.visible = false
            if (this.enemy) this.enemy.delayActivation = 10.0
            this.experience.camera.instance.position.set(5, 1.6, 5)
            this.experience.camera.instance.lookAt(new THREE.Vector3(5, 1.6, 4))
        } else {
            if (this.robot?.group) this.robot.group.visible = true
        }
    }
}
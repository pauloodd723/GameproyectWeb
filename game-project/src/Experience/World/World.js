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

        setTimeout(() => {
            this.allowPrizePickup = true
        }, 2000)

        this.resources.on('ready', async () => {
            // Iniciar sesión de juego en backend
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
            } catch (e) {
                console.warn('[API] No se pudo registrar sesión:', e.message)
            }

            // Obtener puntos globales iniciales
            try {
                const res = await fetch(`${BACKEND}/api/game/stats`, { credentials: 'include' })
                if (res.ok) {
                    const data = await res.json()
                    this.globalPoints = data.stats?.global_points || 0
                    window.dispatchEvent(new CustomEvent('hud-global-points', { detail: this.globalPoints }))
                }
            } catch (e) { /* sin conexión, ok */ }

            this.floor = new Floor(this.experience)
            this.environment = new Environment(this.experience)

            this.loader = new ToyCarLoader(this.experience)
            await this.loader.loadFromAPI()

            this.fox = new Fox(this.experience)
            this.robot = new Robot(this.experience)

            // Enemigos múltiples: plantilla y spawn lejos del jugador
            const enemiesCountEnv = parseInt(import.meta.env.VITE_ENEMIES_COUNT || '3', 10)
            const enemiesCount = Number.isFinite(enemiesCountEnv) && enemiesCountEnv > 0 ? enemiesCountEnv : 3
            this.spawnEnemies(enemiesCount)

            this.experience.vr.bindCharacter(this.robot)
            this.thirdPersonCamera = new ThirdPersonCamera(this.experience, this.robot.group)

            this.mobileControls = new MobileControls({
                onUp: (pressed) => { this.experience.keyboard.keys.up = pressed },
                onDown: (pressed) => { this.experience.keyboard.keys.down = pressed },
                onLeft: (pressed) => { this.experience.keyboard.keys.left = pressed },
                onRight: (pressed) => { this.experience.keyboard.keys.right = pressed }
            })

            if (!this.experience.physics || !this.experience.physics.world) {
                console.error("🚫 Sistema de físicas no está inicializado al cargar el mundo.");
                return;
            }

            // Si se está en modo VR, ocultar el robot
            this._checkVRMode()

            this.experience.renderer.instance.xr.addEventListener('sessionstart', () => {
                this._checkVRMode()
            })


        })
    }

    triggerDefeat() {
        if (this.defeatTriggered) return
        this.defeatTriggered = true

        this.robot?.die()

        window.dispatchEvent(new CustomEvent('hud-death'))
        gameAPI('/death', {
            level: this.levelManager.currentLevel,
            sessionId: this.sessionId
        })

        if (window.userInteracted && this.loseSound) {
            this.loseSound.play()
        }

        this.experience.modal.show({
            icon: '💀',
            message: '¡El enemigo te atrapó!\n¿Quieres intentarlo otra vez?',
            buttons: [
                { text: '🔁 Reintentar', onClick: () => this.experience.resetGameToFirstLevel() },
                { text: '❌ Salir', onClick: () => this.experience.resetGame() }
            ]
        })
    }

    // Crear varios enemigos en posiciones alejadas del jugador para evitar atascos iniciales
    spawnEnemies(count = 3) {
        if (!this.robot?.body?.position) return

        const playerPos = this.robot.body.position
        console.log('[spawnEnemies] Posición del jugador:', playerPos.x.toFixed(1), playerPos.y.toFixed(1), playerPos.z.toFixed(1))

        // Limpia anteriores si existen
        if (this.enemies?.length) {
            this.enemies.forEach(e => e?.destroy?.())
            this.enemies = []
        }

        // Construir el template del modelo
        const zombieGlb = this.resources?.items?.zombieModel
        console.log('[spawnEnemies] zombieModel cargado:', !!zombieGlb, '| scene:', !!zombieGlb?.scene)

        // Cada enemigo necesita su propio clone de esqueleto — se crea uno por enemigo
        // (SkeletonUtils.clone se llama dentro del loop, no aquí)
        const useZombie = !!(zombieGlb?.scene)

        const minRadius = 15
        const maxRadius = 25

        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2
            const radius = minRadius + Math.random() * (maxRadius - minRadius)
            const x = playerPos.x + Math.cos(angle) * radius
            const z = playerPos.z + Math.sin(angle) * radius
            const y = playerPos.y + 0.5

            console.log(`[spawnEnemies] Enemigo ${i} spawn:`, x.toFixed(1), y.toFixed(1), z.toFixed(1))

            // Clonar el esqueleto correctamente por cada enemigo
            let modelClone
            if (useZombie) {
                modelClone = SkeletonUtils.clone(zombieGlb.scene)
                // Escalar a ~1 unidad
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

            enemy.delayActivation = 0
            this.enemies.push(enemy)
        }

        console.log('[spawnEnemies] Total enemigos creados:', this.enemies.length)
    }

    toggleAudio() {
        this.ambientSound.toggle()
    }

    update(delta) {
        this.fox?.update()
        this.robot?.update()
        this.blockPrefab?.update()

        // Siempre actualizar enemigos para sincronizar visual con físicas
        this.enemies?.forEach(e => e.update(delta, this.gameStarted))

        // Detección de derrota solo cuando el juego está activo
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
            return // No hay posición válida, salimos del update
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

                    // Actualizar puntos globales en backend y HUD
                    fetch(`${BACKEND}/api/game/coin`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({
                            level: this.levelManager.currentLevel,
                            coinName: prize.name || prize.role,
                            sessionId: this.sessionId
                        })
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

                            new FinalPrizeParticles({
                                scene: this.scene,
                                targetPosition: finalCoin.pivot.position,
                                sourcePosition: this.robot.body.position,
                                experience: this.experience
                            })

                            this._createFinalPrizeBeam(finalCoin.pivot.position)

                            if (window.userInteracted) {
                                this.portalSound.play()
                            }

                            console.log("🪙 Coin final activado correctamente.")
                        }
                    }
                }

                if (prize.role === "finalPrize") {
                    if (this.levelManager.currentLevel < this.levelManager.totalLevels) {
                        gameAPI('/level-complete', {
                            level: this.levelManager.currentLevel,
                            sessionId: this.sessionId,
                            coins: this.points
                        })
                        this.levelManager.nextLevel()
                        this.points = 0
                        this.robot.points = 0
                        window.dispatchEvent(new CustomEvent('hud-points', { detail: 0 }))
                        window.dispatchEvent(new CustomEvent('hud-level', { detail: this.levelManager.currentLevel }))
                    } else {
                        const elapsed = this.experience.tracker.stop()
                        this.experience.tracker.saveTime(elapsed)
                        this.experience.tracker.showEndGameModal(elapsed)

                        this.experience.obstacleWavesDisabled = true
                        clearTimeout(this.experience.obstacleWaveTimeout)
                        this.experience.raycaster?.removeAllObstacles()

                        if (window.userInteracted) {
                            this.winner.play()
                        }
                    }
                }

                if (this.experience.raycaster?.removeRandomObstacles) {
                    const reduction = 0.2 + Math.random() * 0.1
                    this.experience.raycaster.removeRandomObstacles(reduction)
                }

                if (window.userInteracted) {
                    this.coinSound.play()
                }

                this.experience.menu.setStatus?.(`🎖️ Puntos: ${this.points}`)
            }
        })

        // ✅ Verificar si todas las monedas se han recogido y aún no se activó el finalPrize
        // ✅ Activar finalPrize si todas las monedas default fueron recolectadas (desde VR o PC)
        if (!this.finalPrizeActivated && this.loader?.prizes) {
            const totalDefault = this.loader.prizes.filter(p => p.role === 'default').length
            const collectedDefault = this.loader.prizes.filter(p => p.role === 'default' && p.collected).length

            if (totalDefault > 0 && collectedDefault === totalDefault) {
                const finalCoin = this.loader.prizes.find(p => p.role === "finalPrize")
                if (finalCoin && !finalCoin.collected && finalCoin.pivot) {
                    finalCoin.pivot.visible = true
                    if (finalCoin.model) finalCoin.model.visible = true
                    this.finalPrizeActivated = true

                    new FinalPrizeParticles({
                        scene: this.scene,
                        targetPosition: finalCoin.pivot.position,
                        sourcePosition: this.experience.vrDolly?.position ?? this.experience.camera.instance.position,
                        experience: this.experience
                    })

                    this._createFinalPrizeBeam(finalCoin.pivot.position)

                    if (window.userInteracted) {
                        this.portalSound.play()
                    }

                    console.log("🪙 FinalPrize activado automáticamente desde VR.")
                }
            }
        }


        // Pulsar rayo de la gema final
        if (this.finalPrizeBeam) {
            this.finalPrizeBeam.material.opacity = 0.18 + Math.sin(Date.now() * 0.002) * 0.08
        }
        if (this.finalPrizeBeamLight) {
            this.finalPrizeBeamLight.intensity = 2 + Math.sin(Date.now() * 0.003) * 1
        }

        // Optimización física por distancia
        const playerPos = this.experience.renderer.instance.xr.isPresenting
            ? this.experience.camera.instance.position
            : this.robot?.body?.position

        this.scene.traverse((obj) => {
            if (obj.userData?.levelObject && obj.userData.physicsBody) {
                const dist = obj.position.distanceTo(playerPos)
                const shouldEnable = dist < 40 && obj.visible

                const body = obj.userData.physicsBody
                if (shouldEnable && !body.enabled) {
                    body.enabled = true
                } else if (!shouldEnable && body.enabled) {
                    body.enabled = false
                }
            }
        })
    }


    async loadLevel(level) {
        try {
            const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
            const apiUrl = `${backendUrl}/api/blocks?level=${level}`;

            let data;
            try {
                const res = await fetch(apiUrl);
                if (!res.ok) throw new Error('Error desde API');
                // Asegurar que la respuesta sea JSON
                const ct = res.headers.get('content-type') || '';
                if (!ct.includes('application/json')) {
                    const preview = (await res.text()).slice(0, 120);
                    throw new Error(`Respuesta no-JSON desde API (${apiUrl}): ${preview}`);
                }
                data = await res.json();
                console.log(`📦 Datos del nivel ${level} cargados desde API`);
            } catch (error) {
                console.warn(`⚠️ No se pudo conectar con el backend. Usando datos locales para nivel ${level}...`);
                const publicPath = (p) => {
                    const base = import.meta.env.BASE_URL || '/';
                    return `${base.replace(/\/$/, '')}/${p.replace(/^\//, '')}`;
                };

                const localUrl = publicPath('data/toy_car_blocks.json');
                const localRes = await fetch(localUrl);
                if (!localRes.ok) {
                    const preview = (await localRes.text()).slice(0, 120);
                    throw new Error(`No se pudo cargar ${localUrl} (HTTP ${localRes.status}). Vista previa: ${preview}`);
                }
                const localCt = localRes.headers.get('content-type') || '';
                if (!localCt.includes('application/json')) {
                    const preview = (await localRes.text()).slice(0, 120);
                    throw new Error(`Contenido no JSON en ${localUrl}. Vista previa: ${preview}`);
                }
                const allBlocks = await localRes.json();

                const filteredBlocks = allBlocks.filter(b => b.level === level);

                data = {
                    blocks: filteredBlocks,
                    spawnPoint: { x: -17, y: 1.5, z: -67 } // valor por defecto si no viene en JSON
                };
            }

            const spawnPoint = data.spawnPoint || { x: -17, y: 1.5, z: -67 };
            this.currentSpawnPoint = spawnPoint;
            this.points = 0;
            this.robot.points = 0;
            this.finalPrizeActivated = false;
            window.dispatchEvent(new CustomEvent('hud-level', { detail: level }));
            this.experience.menu.setStatus?.(`🎖️ Puntos: ${this.points}`);

            if (data.blocks) {
                const publicPath = (p) => {
                    const base = import.meta.env.BASE_URL || '/';
                    return `${base.replace(/\/$/, '')}/${p.replace(/^\//, '')}`;
                };
                const preciseUrl = publicPath('config/precisePhysicsModels.json');
                const preciseRes = await fetch(preciseUrl);
                if (!preciseRes.ok) {
                    const preview = (await preciseRes.text()).slice(0, 120);
                    throw new Error(`No se pudo cargar ${preciseUrl} (HTTP ${preciseRes.status}). Vista previa: ${preview}`);
                }
                const preciseCt = preciseRes.headers.get('content-type') || '';
                if (!preciseCt.includes('application/json')) {
                    const preview = (await preciseRes.text()).slice(0, 120);
                    throw new Error(`Contenido no JSON en ${preciseUrl}. Vista previa: ${preview}`);
                }
                const preciseModels = await preciseRes.json();
                this.loader._processBlocks(data.blocks, preciseModels);
            } else {
                await this.loader.loadFromURL(apiUrl);
            }


            this.loader.prizes.forEach(p => {
                if (p.model) p.model.visible = (p.role !== 'finalPrize');
                p.collected = false;
            });

            this.totalDefaultCoins = this.loader.prizes.filter(p => p.role === "default").length;
            console.log(`🎯 Total de monedas default para el nivel ${level}: ${this.totalDefaultCoins}`);

            this.resetRobotPosition(spawnPoint);
            console.log(`✅ Nivel ${level} cargado con spawn en`, spawnPoint);
        } catch (error) {
            console.error('❌ Error cargando nivel:', error);
        }
    }

    clearCurrentScene() {
        if (!this.experience || !this.scene || !this.experience.physics || !this.experience.physics.world) {
            console.warn('⚠️ No se puede limpiar: sistema de físicas no disponible.');
            return;
        }

        let visualObjectsRemoved = 0;
        let physicsBodiesRemoved = 0;

        const childrenToRemove = [];

        this.scene.children.forEach((child) => {
            if (child.userData && child.userData.levelObject) {
                childrenToRemove.push(child);
            }
        });

        childrenToRemove.forEach((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => mat.dispose());
                } else {
                    child.material.dispose();
                }
            }

            this.scene.remove(child);

            if (child.userData.physicsBody) {
                this.experience.physics.world.removeBody(child.userData.physicsBody);
            }

            visualObjectsRemoved++;
        });

        let physicsBodiesRemaining = -1;

        if (this.experience.physics && this.experience.physics.world && Array.isArray(this.experience.physics.bodies)) {
            const survivingBodies = [];
            let bodiesBefore = this.experience.physics.bodies.length;

            this.experience.physics.bodies.forEach((body) => {
                if (body.userData && body.userData.levelObject) {
                    this.experience.physics.world.removeBody(body);
                    physicsBodiesRemoved++;
                } else {
                    survivingBodies.push(body);
                }
            });

            this.experience.physics.bodies = survivingBodies;

            console.log(`🧹 Physics Cleanup Report:`);
            console.log(`✅ Cuerpos físicos eliminados: ${physicsBodiesRemoved}`);
            console.log(`🎯 Cuerpos físicos sobrevivientes: ${survivingBodies.length}`);
            console.log(`📦 Estado inicial: ${bodiesBefore} cuerpos → Estado final: ${survivingBodies.length} cuerpos`);
        } else {
            console.warn('⚠️ Physics system no disponible o sin cuerpos activos, omitiendo limpieza física.');
        }

        console.log(`🧹 Escena limpiada antes de cargar el nuevo nivel.`);
        console.log(`✅ Objetos 3D eliminados: ${visualObjectsRemoved}`);
        console.log(`✅ Cuerpos físicos eliminados: ${physicsBodiesRemoved}`);
        console.log(`🎯 Objetos 3D actuales en escena: ${this.scene.children.length}`);

        if (physicsBodiesRemaining !== -1) {
            console.log(`🎯 Cuerpos físicos actuales en Physics World: ${physicsBodiesRemaining}`);
        }

        if (this.loader && this.loader.prizes.length > 0) {
            this.loader.prizes.forEach(prize => {
                // El pivot es el objeto que se agrega directamente a la escena
                if (prize.pivot) {
                    prize.pivot.traverse(child => {
                        if (child.geometry) child.geometry.dispose()
                        if (child.material) {
                            if (Array.isArray(child.material)) child.material.forEach(m => m.dispose())
                            else child.material.dispose()
                        }
                    })
                    this.scene.remove(prize.pivot)
                }
            });
            this.loader.prizes = [];
            console.log('🎯 Premios del nivel anterior eliminados correctamente.');
        }

        this.finalPrizeActivated = false


        if (this.finalPrizeBeam) {
            this.finalPrizeBeam.geometry.dispose()
            this.finalPrizeBeam.material.dispose()
            this.scene.remove(this.finalPrizeBeam)
            this.finalPrizeBeam = null
        }
        if (this.finalPrizeBeamLight) {
            this.scene.remove(this.finalPrizeBeamLight)
            this.finalPrizeBeamLight = null
        }

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
        const preciseRes = await fetch('/config/precisePhysicsModels.json');
        const preciseModels = await preciseRes.json();
        this.loader._processBlocks(blocks, preciseModels);

        this.loader.prizes.forEach(p => {
            if (p.model) p.model.visible = (p.role !== 'finalPrize');
            p.collected = false;
        });

        this.totalDefaultCoins = this.loader.prizes.filter(p => p.role === "default").length;
        console.log(`🎯 Total de monedas default para el nivel local: ${this.totalDefaultCoins}`);
    }

    _createFinalPrizeBeam(position) {
        // Rayo vertical verde sobre la gema final
        const beamGeo = new THREE.CylinderGeometry(0.05, 0.6, 30, 6, 1, true)
        const beamMat = new THREE.MeshBasicMaterial({
            color: 0x00ff88,
            transparent: true,
            opacity: 0.2,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        })
        this.finalPrizeBeam = new THREE.Mesh(beamGeo, beamMat)
        this.finalPrizeBeam.position.set(position.x, position.y + 15, position.z)
        this.scene.add(this.finalPrizeBeam)

        this.finalPrizeBeamLight = new THREE.PointLight(0x00ff88, 3, 18)
        this.finalPrizeBeamLight.position.set(position.x, position.y + 1, position.z)
        this.scene.add(this.finalPrizeBeamLight)
    }

    _checkVRMode() {
        const isVR = this.experience.renderer.instance.xr.isPresenting

        if (isVR) {
            if (this.robot?.group) {
                this.robot.group.visible = false
            }

            // 🔁 Delay de 3s para que no ataque de inmediato en VR
            if (this.enemy) {
                this.enemy.delayActivation = 10.0
            }

            // 🧠 Posicionar cámara correctamente
            this.experience.camera.instance.position.set(5, 1.6, 5)
            this.experience.camera.instance.lookAt(new THREE.Vector3(5, 1.6, 4))
        } else {
            if (this.robot?.group) {
                this.robot.group.visible = true
            }
        }
    }


}
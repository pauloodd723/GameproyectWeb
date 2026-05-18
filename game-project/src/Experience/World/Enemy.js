import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import Sound from './Sound.js'

export default class Enemy {
    constructor({ scene, physicsWorld, playerRef, model, position, experience, zombieGlb = null }) {
        this.experience   = experience
        this.scene        = scene
        this.physicsWorld = physicsWorld
        this.playerRef    = playerRef
        this._dead        = false

        // ✅ Velocidad según nivel
        const nivel = experience.world?.levelManager?.currentLevel || 1
        const speeds = { 1: 1.2, 2: 1.6, 3: 2.0, 4: 2.5, 5: 3.2 }
        this.baseSpeed = speeds[nivel] || 1.2
        this.speed     = this.baseSpeed

        this.delayActivation = 0

        this.proximitySound = new Sound('/sounds/alert.ogg', { loop: true, volume: 0 })
        this.proximitySound.play()

        // ── Modelo ────────────────────────────────────────────────────────────
        this.model = model

        // ✅ Zombie más grande: escala 0.22 (antes 0.163)
        // Offset Y: 2.249 * 0.22 = 0.495
        this.model.scale.set(0.22, 0.22, 0.22)
        this.model.position.set(position.x, position.y - 0.495, position.z)
        this.scene.add(this.model)

        // ── Animación ─────────────────────────────────────────────────────────
        if (zombieGlb?.animations?.length) {
            this.mixer = new THREE.AnimationMixer(this.model)

            // [11] Walk — zombie de pie caminando
            const walkClip = zombieGlb.animations[11]
                || zombieGlb.animations.find(a => a.name === 'Armature|Walk')
                || zombieGlb.animations.find(a => /walk/i.test(a.name) && !/crawl/i.test(a.name))

            if (walkClip) {
                const action = this.mixer.clipAction(walkClip)
                action.setLoop(THREE.LoopRepeat, Infinity)
                action.play()
            }
        }

        // ── Física ────────────────────────────────────────────────────────────
        const mat    = new CANNON.Material('enemyMaterial')
        mat.friction = 0.0

        this.body = new CANNON.Body({
            mass:          5,
            shape:         new CANNON.Sphere(0.5),
            material:      mat,
            position:      new CANNON.Vec3(position.x, position.y, position.z),
            linearDamping: 0.01
        })

        if (this.playerRef?.body) {
            this.body.position.y = this.playerRef.body.position.y
        }

        this.body.sleepSpeedLimit = 0.0
        this.body.wakeUp()
        this.physicsWorld.addBody(this.body)
        this.model.userData.physicsBody = this.body

        this._onCollide = (event) => {
            if (event.body !== this.playerRef?.body) return
            this.experience.world?.triggerDefeat()
            this.proximitySound?.stop()
            if (this.model?.parent) this.destroy()
        }
        this.body.addEventListener('collide', this._onCollide)
    }

    update(delta, gameActive = false) {
        if (this._dead) return

        if (this.body && this.model) {
            this.model.position.x = this.body.position.x
            this.model.position.y = this.body.position.y - 0.495
            this.model.position.z = this.body.position.z
        }

        if (this.mixer) this.mixer.update(delta)

        if (!gameActive) return
        if (this.delayActivation > 0) {
            this.delayActivation -= delta
            return
        }
        if (!this.body || !this.playerRef?.body) return

        const ePos = this.body.position
        const pPos = this.playerRef.body.position

        const dx       = pPos.x - ePos.x
        const dz       = pPos.z - ePos.z
        const distance = Math.sqrt(dx * dx + dz * dz)

        const vol = Math.max(0, 1 - Math.min(distance, 15) / 15)
        this.proximitySound?.setVolume(vol * 0.8)

        if (distance < 0.8) return

        this.speed = distance < 5 ? this.baseSpeed * 1.6 : this.baseSpeed

        const len = Math.sqrt(dx * dx + dz * dz)
        const nx  = dx / len
        const nz  = dz / len

        this.body.velocity.x = nx * this.speed
        this.body.velocity.z = nz * this.speed
        this.body.velocity.y = (pPos.y - ePos.y) * 2

        this.model.rotation.y = Math.atan2(nx, nz)
    }

    destroy() {
        if (this._dead) return
        this._dead = true
        if (this.model) {
            this.scene.remove(this.model)
            this.model = null
        }
        this.proximitySound?.stop()
        if (this.body) {
            this.body.removeEventListener('collide', this._onCollide)
            if (this.physicsWorld.bodies.includes(this.body)) {
                this.physicsWorld.removeBody(this.body)
            }
            this.body = null
        }
    }
}
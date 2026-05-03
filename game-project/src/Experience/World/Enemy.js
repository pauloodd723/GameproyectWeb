import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import Sound from './Sound.js'

export default class Enemy {
    constructor({ scene, physicsWorld, playerRef, model, position, experience, zombieGlb = null }) {
        this.experience = experience
        this.scene = scene
        this.physicsWorld = physicsWorld
        this.playerRef = playerRef
        this.baseSpeed = 1.0
        this.speed = this.baseSpeed
        this.delayActivation = 0

        // Sonido de proximidad en loop
        this.proximitySound = new Sound('/sounds/alert.ogg', { loop: true, volume: 0 })
        this._soundCooldown = 0
        this.proximitySound.play()

        // El modelo ya viene clonado correctamente con SkeletonUtils desde World.js
        this.model = model
        this.model.position.copy(position)
        this.scene.add(this.model)

        // Animación — usa clips del GLB original
        if (zombieGlb?.animations?.length) {
            this.mixer = new THREE.AnimationMixer(this.model)
            const clip = zombieGlb.animations.find(a =>
                /walk|run|move/i.test(a.name)
            ) || zombieGlb.animations[0]
            this.mixer.clipAction(clip).play()
        }

        // Material físico
        const enemyMaterial = new CANNON.Material('enemyMaterial')
        enemyMaterial.friction = 0.0

        // Cuerpo físico
        this.body = new CANNON.Body({
            mass: 5,
            shape: new CANNON.Sphere(0.5),
            material: enemyMaterial,
            position: new CANNON.Vec3(position.x, position.y, position.z),
            linearDamping: 0.01
        })

        // Alinear altura con el robot (igual que original)
        if (this.playerRef?.body) {
            this.body.position.y = this.playerRef.body.position.y
            this.model.position.y = this.body.position.y
        }

        this.body.sleepSpeedLimit = 0.0
        this.body.wakeUp()
        this.physicsWorld.addBody(this.body)

        this.model.userData.physicsBody = this.body

        // Colisión con robot — igual que original
        this._onCollide = (event) => {
            if (event.body !== this.playerRef?.body) return
            this.experience.world?.triggerDefeat()
            if (this.proximitySound) this.proximitySound.stop()
            if (this.model.parent) this.destroy()
        }
        this.body.addEventListener('collide', this._onCollide)
    }

    update(delta, gameActive = false) {
        // Siempre sincronizar visual con cuerpo físico, incluso antes de iniciar juego
        if (this.body && this.model) {
            this.model.position.copy(this.body.position)
        }
        if (this.mixer) this.mixer.update(delta)

        // Movimiento AI solo cuando el juego está activo
        if (!gameActive) return

        if (this.delayActivation > 0) {
            this.delayActivation -= delta
            return
        }

        if (!this.body || !this.playerRef?.body) return

        const targetPos = new CANNON.Vec3(
            this.playerRef.body.position.x,
            this.playerRef.body.position.y,
            this.playerRef.body.position.z
        )
        const enemyPos = this.body.position

        const distance = enemyPos.distanceTo(targetPos)
        this.speed = distance < 4 ? 2.5 : this.baseSpeed

        const maxDistance = 10
        const proximityVolume = 1 - Math.min(distance, maxDistance) / maxDistance
        this.proximitySound?.setVolume(proximityVolume * 0.8)

        const direction = new CANNON.Vec3(
            targetPos.x - enemyPos.x,
            targetPos.y - enemyPos.y,
            targetPos.z - enemyPos.z
        )

        if (direction.length() > 0.5) {
            direction.normalize()
            direction.scale(this.speed, direction)
            this.body.velocity.x = direction.x
            this.body.velocity.y = direction.y
            this.body.velocity.z = direction.z
        }
    }

    destroy() {
        if (this.model) {
            this.scene.remove(this.model)
            this.model = null
        }
        if (this.proximitySound) this.proximitySound.stop()
        if (this.body) {
            this.body.removeEventListener('collide', this._onCollide)
            if (this.physicsWorld.bodies.includes(this.body)) {
                this.physicsWorld.removeBody(this.body)
            }
            this.body = null
        }
    }
}

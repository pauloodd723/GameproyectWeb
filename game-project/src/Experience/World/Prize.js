import * as THREE from 'three'

export default class Prize {
    constructor({ model, position, scene, role = 'default', sound = null, experience = null }) {
        this.scene = scene
        this.experience = experience
        this.collected = false
        this.role = role
        this.sound = sound

        this.pivot = new THREE.Group()
        this.pivot.position.copy(position)
        this.pivot.userData.interactivo = true
        this.pivot.userData.collected = false

        // Clonar y normalizar tamaño de la gema
        this.model = model.clone()
        const bbox = new THREE.Box3().setFromObject(this.model)
        const size = new THREE.Vector3()
        bbox.getSize(size)
        const maxDim = Math.max(size.x, size.y, size.z)
        if (maxDim > 0) this.model.scale.multiplyScalar(0.5 / maxDim)

        // Centrar en su eje
        const center = new THREE.Vector3()
        new THREE.Box3().setFromObject(this.model).getCenter(center)
        this.model.position.sub(center)

        this.pivot.add(this.model)
        this.scene.add(this.pivot)
        this.pivot.visible = role !== 'finalPrize'

        this._initIdleParticles()

        console.log(`🎯 Premio en: (${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)}) [role: ${this.role}]`)
    }

    _initIdleParticles() {
        const count = 10
        const positions = new Float32Array(count * 3)
        this._pAngles = Array.from({ length: count }, (_, i) => (i / count) * Math.PI * 2)

        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        const mat = new THREE.PointsMaterial({
            size: 0.08,
            color: 0x00ff88,
            transparent: true,
            opacity: 0.8,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        })
        this._idleParticles = new THREE.Points(geo, mat)
        this.scene.add(this._idleParticles)
    }

    update(delta) {
        if (this.collected) return
        this.pivot.rotation.y += delta * 1.5

        if (this._idleParticles) {
            const wp = new THREE.Vector3()
            this.pivot.getWorldPosition(wp)
            const pos = this._idleParticles.geometry.attributes.position
            for (let i = 0; i < pos.count; i++) {
                this._pAngles[i] += delta * 2.5
                pos.setX(i, wp.x + Math.cos(this._pAngles[i]) * 0.4)
                pos.setY(i, wp.y + 0.2 + Math.sin(this._pAngles[i] * 2 + i) * 0.15)
                pos.setZ(i, wp.z + Math.sin(this._pAngles[i]) * 0.4)
            }
            pos.needsUpdate = true
        }
    }

    collect() {
        if (this.collected) return
        this.collected = true

        if (this._idleParticles) {
            this.scene.remove(this._idleParticles)
            this._idleParticles.geometry.dispose()
            this._idleParticles.material.dispose()
            this._idleParticles = null
        }

        if (this.experience) this._burstGreen()

        if (this.sound && typeof this.sound.play === 'function') {
            this.sound.play()
        }

        this.pivot.traverse(child => { child.userData.collected = true })
        this.scene.remove(this.pivot)
    }

    _burstGreen() {
        const count = 20
        const posArr = new Float32Array(count * 3)
        const velocities = []
        const wp = new THREE.Vector3()
        this.pivot.getWorldPosition(wp)

        for (let i = 0; i < count; i++) {
            posArr[i * 3]     = wp.x
            posArr[i * 3 + 1] = wp.y
            posArr[i * 3 + 2] = wp.z
            velocities.push({
                x: (Math.random() - 0.5) * 4,
                y: 1 + Math.random() * 4,
                z: (Math.random() - 0.5) * 4
            })
        }

        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3))
        const mat = new THREE.PointsMaterial({
            size: 0.18,
            color: 0x00ff44,
            transparent: true,
            opacity: 1,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        })
        const points = new THREE.Points(geo, mat)
        this.experience.scene.add(points)

        const start = Date.now()
        const tick = () => {
            const t = (Date.now() - start) / 1000
            if (t > 1.2) {
                this.experience.scene.remove(points)
                geo.dispose()
                mat.dispose()
                this.experience.time.off('tick', tick)
                return
            }
            const a = geo.attributes.position
            const dt = 1 / 60
            for (let i = 0; i < count; i++) {
                a.setX(i, a.getX(i) + velocities[i].x * dt)
                a.setY(i, a.getY(i) + velocities[i].y * dt)
                a.setZ(i, a.getZ(i) + velocities[i].z * dt)
                velocities[i].y -= 8 * dt
            }
            a.needsUpdate = true
            mat.opacity = 1 - t / 1.2
        }
        this.experience.time.on('tick', tick)
    }
}

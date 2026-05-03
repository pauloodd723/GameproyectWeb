import * as THREE from 'three'

export default class FinalPrizeParticles {
    constructor({ scene, targetPosition, sourcePosition, experience }) {
        this.scene = scene
        this.experience = experience

        // Colores esmeralda para el burst
        const colors = [0x00ff88, 0x00ffcc, 0x44ffaa, 0x00dd66, 0xaaffdd]
        this._systems = []

        // Crea 3 capas de partículas con distintos parámetros
        this._spawn(sourcePosition, targetPosition, 40, colors[0], 0.22, 2.5)
        this._spawn(sourcePosition, targetPosition, 25, colors[1], 0.14, 3.2)
        this._spawn(sourcePosition, targetPosition, 15, colors[2], 0.30, 1.8)

        setTimeout(() => this.dispose(), 2500)
    }

    _spawn(source, target, count, color, size, speed) {
        const positions = new Float32Array(count * 3)
        const velocities = []

        for (let i = 0; i < count; i++) {
            positions[i * 3]     = source.x
            positions[i * 3 + 1] = source.y
            positions[i * 3 + 2] = source.z

            // Dirección: mezcla entre random sphere y hacia el target
            const rand = new THREE.Vector3(
                (Math.random() - 0.5),
                (Math.random() - 0.5),
                (Math.random() - 0.5)
            ).normalize()

            const toTarget = new THREE.Vector3(
                target.x - source.x,
                target.y - source.y,
                target.z - source.z
            ).normalize()

            const dir = rand.lerp(toTarget, 0.4).normalize()
            velocities.push(dir.multiplyScalar(speed * (0.6 + Math.random() * 0.8)))
        }

        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))

        const mat = new THREE.PointsMaterial({
            size,
            color,
            transparent: true,
            opacity: 1.0,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true
        })

        const points = new THREE.Points(geo, mat)
        this.scene.add(points)

        const start = Date.now()
        const tick = () => {
            const t = (Date.now() - start) / 1000
            if (t > 2.5) return

            const a = geo.attributes.position
            const dt = 1 / 60
            for (let i = 0; i < count; i++) {
                a.setX(i, a.getX(i) + velocities[i].x * dt)
                a.setY(i, a.getY(i) + velocities[i].y * dt)
                a.setZ(i, a.getZ(i) + velocities[i].z * dt)
                velocities[i].multiplyScalar(0.97) // desaceleración
                velocities[i].y -= 3 * dt            // gravedad leve
            }
            a.needsUpdate = true
            mat.opacity = t < 0.3 ? t / 0.3 : 1 - (t - 0.3) / 2.2
        }

        this.experience.time.on('tick', tick)
        this._systems.push({ points, geo, mat, tick })
    }

    dispose() {
        this._systems.forEach(({ points, geo, mat, tick }) => {
            this.experience.time.off('tick', tick)
            this.scene.remove(points)
            geo.dispose()
            mat.dispose()
        })
        this._systems = []
    }
}

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import EventEmitter from './EventEmitter.js'

export default class Resources extends EventEmitter {
    constructor(sources) {
        super()

        this.sources = sources
        this.items = {}
        this.toLoad = this.sources.length
        this.loaded = 0

        this.setLoaders()
        this.startLoading()
    }

    setLoaders() {
        this.loaders = {}
        this.loaders.gltfLoader = new GLTFLoader()
        this.loaders.textureLoader = new THREE.TextureLoader()
        this.loaders.cubeTextureLoader = new THREE.CubeTextureLoader()
    }

    startLoading() {
        for (const source of this.sources) {
            if (source.type === 'gltfModel') {
                this.loaders.gltfLoader.load(
                    source.path,
                    (file) => { this.sourceLoaded(source, file) },
                    undefined,
                    (error) => {
                        console.warn(`[Resources] No se pudo cargar modelo: ${source.name}`, error?.message ?? error)
                        this.sourceLoaded(source, null)
                    }
                )
            } else if (source.type === 'texture') {
                this.loaders.textureLoader.load(
                    source.path,
                    (file) => { this.sourceLoaded(source, file) },
                    undefined,
                    (error) => {
                        console.warn(`[Resources] No se pudo cargar textura: ${source.name}`, error?.message ?? error)
                        this.sourceLoaded(source, null)
                    }
                )
            } else if (source.type === 'cubeTexture') {
                this.loaders.cubeTextureLoader.load(
                    source.path,
                    (file) => { this.sourceLoaded(source, file) },
                    undefined,
                    (error) => {
                        console.warn(`[Resources] No se pudo cargar cubemap: ${source.name}`, error?.message ?? error)
                        this.sourceLoaded(source, null)
                    }
                )
            }
        }
    }

    sourceLoaded(source, file) {
        this.items[source.name] = file
        this.loaded++

        const percent = Math.floor((this.loaded / this.toLoad) * 100)
        window.dispatchEvent(new CustomEvent('resource-progress', { detail: percent }))

        if (this.loaded === this.toLoad) {
            window.dispatchEvent(new CustomEvent('resource-complete'))
            this.trigger('ready')
        }
    }
}

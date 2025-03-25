import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import EventEmitter from './EventEmitter.js';

export default class Resources extends EventEmitter {
    constructor() {
        super();

        this.items = {};
        this.toLoad = 0;
        this.loaded = 0;
        this.loaders = {};

        this.setLoaders();
        this.startLoading();
        
        // Add a safety timeout to force completion if some loads get stuck
        this.loadingTimeout = setTimeout(() => {
            console.warn("Loading timeout reached, forcing completion");
            if (this.loaded < this.toLoad) {
                const loadingBarElement = document.querySelector('.loading-bar');
                const loadingTextElement = document.querySelector('.loading-text');
                
                loadingBarElement.style.transform = 'scaleX(1)';
                this.trigger('ready');
                
                setTimeout(() => {
                    loadingBarElement.classList.add('ended');
                    loadingTextElement.classList.add('ended');
                }, 500);
            }
        }, 5000); // 5-second timeout
    }

    setLoaders() {
        this.loaders = {
            gltfLoader: new GLTFLoader(),
            textureLoader: new THREE.TextureLoader(),
            cubeTextureLoader: new THREE.CubeTextureLoader()
        };
    }

    startLoading() {
        // Update loadingBar element
        const loadingBarElement = document.querySelector('.loading-bar');
        const loadingTextElement = document.querySelector('.loading-text');

        // Resource sources
        const sources = [
            {
                name: 'rcCarModel',
                type: 'gltfModel',
                path: '/models/rc_f1.glb'
            },
            {
                name: 'billboardModel',
                type: 'gltfModel',
                path: '/models/billboard.glb'
            },
            {
                name: 'xyzSignTexture',
                type: 'texture',
                path: '/textures/signs/xyz_sign.jpg'
            },
            {
                name: 'xySignTexture',
                type: 'texture',
                path: '/textures/signs/xy_sign.jpg'
            },
            {
                name: 'waveSignTexture',
                type: 'texture',
                path: '/textures/signs/wave_sign.jpg'
            },
            {
                name: 'trackTexture',
                type: 'texture',
                path: '/textures/track/dark_track.jpg'
            },
            {
                name: 'environmentMap',
                type: 'cubeTexture',
                path: [
                    '/textures/environmentMap/px.jpg',
                    '/textures/environmentMap/nx.jpg',
                    '/textures/environmentMap/py.jpg',
                    '/textures/environmentMap/ny.jpg',
                    '/textures/environmentMap/pz.jpg',
                    '/textures/environmentMap/nz.jpg'
                ]
            }
        ];

        // Set the toLoad count
        this.toLoad = sources.length;

        // Load each source
        for (const source of sources) {
            switch (source.type) {
                case 'gltfModel':
                    console.log(`Attempting to load model from: ${source.path}`);
                    this.loaders.gltfLoader.load(
                        source.path,
                        (file) => {
                            console.log(`Successfully loaded model: ${source.name}`, file);
                            this.sourceLoaded(source, file);
                        },
                        (progress) => {
                            // Log progress for larger files
                            if (progress.loaded && progress.total) {
                                const percent = Math.round((progress.loaded / progress.total) * 100);
                                if (percent % 25 === 0) { // Log at 0%, 25%, 50%, 75%, 100%
                                    console.log(`Loading ${source.name}: ${percent}% (${progress.loaded}/${progress.total})`);
                                }
                            }
                        },
                        (error) => {
                            console.error(`Error loading GLTF model: ${source.path}`, error);
                            console.log(`Attempting alternative path for ${source.name}`);
                            
                            // Try an alternative path as fallback (try without and with leading slash)
                            const altPath = source.path.startsWith('/') 
                                ? source.path.substring(1) 
                                : '/' + source.path;
                                
                            this.loaders.gltfLoader.load(
                                altPath,
                                (file) => {
                                    console.log(`Successfully loaded model from alternative path: ${altPath}`, file);
                                    this.sourceLoaded(source, file);
                                },
                                undefined,
                                (secondError) => {
                                    console.error(`Also failed with alternative path: ${altPath}`, secondError);
                                    this.handleFailedLoad(source);
                                }
                            );
                        }
                    );
                    break;
                case 'texture':
                    this.loaders.textureLoader.load(
                        source.path,
                        (file) => {
                            this.sourceLoaded(source, file);
                        },
                        undefined,
                        (error) => {
                            console.warn(`Error loading texture: ${source.path}`, error);
                            this.handleFailedLoad(source);
                        }
                    );
                    break;
                case 'cubeTexture':
                    this.loaders.cubeTextureLoader.load(
                        source.path,
                        (file) => {
                            this.sourceLoaded(source, file);
                        },
                        undefined,
                        (error) => {
                            console.warn(`Error loading cube texture: ${source.path}`, error);
                            this.handleFailedLoad(source);
                        }
                    );
                    break;
                default:
                    console.warn(`Unknown source type: ${source.type}`);
                    this.handleFailedLoad(source);
                    break;
            }
        }

        // If there are no items to load
        if (this.toLoad === 0) {
            setTimeout(() => {
                this.trigger('ready');
                loadingBarElement.classList.add('ended');
                loadingTextElement.classList.add('ended');
            }, 500);
        }
    }

    sourceLoaded(source, file) {
        this.items[source.name] = file;
        this.loaded++;

        // Update loading bar
        const loadingBarElement = document.querySelector('.loading-bar');
        const loadingTextElement = document.querySelector('.loading-text');
        
        if (loadingBarElement) {
            loadingBarElement.style.transform = `scaleX(${this.loaded / this.toLoad})`;
        }

        // Trigger ready if all sources have been loaded
        if (this.loaded === this.toLoad) {
            // Clear the safety timeout
            if (this.loadingTimeout) {
                clearTimeout(this.loadingTimeout);
            }
            
            setTimeout(() => {
                this.trigger('ready');
                if (loadingBarElement) loadingBarElement.classList.add('ended');
                if (loadingTextElement) loadingTextElement.classList.add('ended');
            }, 500);
        }
    }

    handleFailedLoad(source) {
        // Count as loaded but warn in console
        this.loaded++;
        console.warn(`Failed to load resource: ${source.name}`);
        
        // Provide fallback data for different source types
        if (source.type === 'gltfModel') {
            // Create an empty group as fallback
            this.items[source.name] = { scene: new THREE.Group() };
        } else if (source.type === 'texture') {
            // Create appropriate fallback textures based on the name
            if (source.name === 'xyzSignTexture') {
                this.items[source.name] = this.createSignTexture('XYZ', '#ff0000');
            } else if (source.name === 'xySignTexture') {
                this.items[source.name] = this.createSignTexture('XY', '#00aa00');
            } else if (source.name === 'waveSignTexture') {
                this.items[source.name] = this.createSignTexture('WAVE', '#0000ff');
            } else if (source.name === 'trackTexture') {
                this.items[source.name] = this.createTrackTexture();
            } else {
                // Generic colored texture
                this.items[source.name] = this.createColorTexture('#FF00FF');
            }
        } else if (source.type === 'cubeTexture') {
            // Create a basic environment map as fallback
            try {
                const texture = new THREE.CubeTexture(Array(6).fill(this.createColorTexture('#555555').image));
                texture.needsUpdate = true;
                this.items[source.name] = texture;
            } catch (error) {
                console.error("Error creating cube texture fallback:", error);
                // Super simple fallback just in case
                this.items[source.name] = null;
            }
        }
        
        // Update loading bar
        const loadingBarElement = document.querySelector('.loading-bar');
        const loadingTextElement = document.querySelector('.loading-text');
        
        if (loadingBarElement) {
            loadingBarElement.style.transform = `scaleX(${this.loaded / this.toLoad})`;
        }
        
        // Trigger ready if all sources have been loaded
        if (this.loaded === this.toLoad) {
            // Clear the safety timeout
            if (this.loadingTimeout) {
                clearTimeout(this.loadingTimeout);
            }
            
            setTimeout(() => {
                this.trigger('ready');
                if (loadingBarElement) loadingBarElement.classList.add('ended');
                if (loadingTextElement) loadingTextElement.classList.add('ended');
            }, 500);
        }
    }

    createColorTexture(color) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const context = canvas.getContext('2d');
        context.fillStyle = color;
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    createSignTexture(text, bgColor) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const context = canvas.getContext('2d');
        
        // Background
        context.fillStyle = bgColor || '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Border
        context.strokeStyle = '#000000';
        context.lineWidth = 16;
        context.strokeRect(16, 16, canvas.width - 32, canvas.height - 32);
        
        // Text
        context.fillStyle = '#ffffff';
        context.font = 'bold 120px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, canvas.width / 2, canvas.height / 2);
        
        // Create texture
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    createTrackTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 1024;
        const context = canvas.getContext('2d');
        
        // Dark background
        context.fillStyle = '#222222';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Track markings - dashed lines
        context.strokeStyle = '#ffffff';
        context.lineWidth = 5;
        context.setLineDash([20, 20]);
        
        // Draw various lines
        for (let i = 0; i < 10; i++) {
            context.beginPath();
            context.moveTo(0, i * 100);
            context.lineTo(canvas.width, i * 100);
            context.stroke();
            
            context.beginPath();
            context.moveTo(i * 100, 0);
            context.lineTo(i * 100, canvas.height);
            context.stroke();
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2, 2);
        texture.needsUpdate = true;
        return texture;
    }
} 
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import Camera from './Camera.js';
import Renderer from './Renderer.js';
import Resources from './utils/Resources.js';
import Debug from './utils/Debug.js';
import Time from './utils/Time.js';
import Sizes from './utils/Sizes.js';
import RCCar from './world/RCCar.js';
import Track from './world/Track.js';
import Environment from './world/Environment.js';
import DebugLineRemover from './utils/DebugLineRemover.js';

export default class Experience {
    constructor(canvas) {
        console.log("Experience constructor called with canvas:", canvas);
        
        // Options
        this.canvas = canvas;

        // Setup
        this.debug = new Debug();
        this.sizes = new Sizes();
        this.time = new Time();
        this.scene = new THREE.Scene();

        try {
            // Setup components in the correct order
            this.setupComponents();
        } catch (error) {
            console.error("Error setting up Experience:", error);
            // Try to setup a minimal fallback experience
            this.setupFallbackExperience();
        }
    }

    setupComponents() {
        console.log("Setting up components");
        
        // Resources must be set up before world components
        this.resources = new Resources();
        
        // Set up camera and renderer
        this.setCamera();
        this.renderer = new Renderer(this);
        
        // World components - track must be initialized first
        this.track = new Track(this);
        this.environment = new Environment(this);
        this.rcCar = new RCCar(this);

        // Initialize debug line remover
        this.debugLineRemover = new DebugLineRemover(this.scene);
        this.debugLineRemover.removeRedLines();
        
        // Start periodic removal to catch any lines that might be added later
        this.debugLineRemover.startPeriodicRemoval(1000);

        // Resize event
        this.sizes.on('resize', () => {
            this.resize();
        });

        // Time tick event
        this.time.on('tick', () => {
            this.update();
        });
        
        // Also check for and remove red lines (separate functionality for redundancy)
        this.removeRedLines();
        
        console.log("Components setup complete");
    }

    setupFallbackExperience() {
        console.log("Setting up fallback experience");
        
        // Create a minimal camera
        this.camera = {
            instance: new THREE.PerspectiveCamera(
                75, 
                window.innerWidth / window.innerHeight, 
                0.1, 
                1000
            ),
            resize: () => {
                this.camera.instance.aspect = window.innerWidth / window.innerHeight;
                this.camera.instance.updateProjectionMatrix();
            },
            update: () => {}
        };
        
        // Position camera
        this.camera.instance.position.set(0, 5, 10);
        this.camera.instance.lookAt(0, 0, 0);
        this.scene.add(this.camera.instance);
        
        // Create a minimal renderer
        this.renderer = {
            instance: new THREE.WebGLRenderer({
                canvas: this.canvas,
                antialias: true
            }),
            resize: () => {
                this.renderer.instance.setSize(window.innerWidth, window.innerHeight);
            },
            update: () => {
                this.renderer.instance.render(this.scene, this.camera.instance);
            }
        };
        
        this.renderer.instance.setSize(window.innerWidth, window.innerHeight);
        this.renderer.instance.setClearColor(0xffffff);
        
        // Add a fallback object - using a gray box instead of red
        const geometry = new THREE.BoxGeometry(2, 0.5, 4);
        const material = new THREE.MeshBasicMaterial({ color: 0x555555 }); // Changed from red to gray
        const cube = new THREE.Mesh(geometry, material);
        cube.position.y = 0.25; // Position it on the ground
        this.scene.add(cube);
        
        // Add a light
        const light = new THREE.DirectionalLight(0xffffff, 1);
        light.position.set(1, 1, 1);
        this.scene.add(light);
        
        // Add a ground plane
        const planeGeometry = new THREE.PlaneGeometry(20, 20);
        const planeMaterial = new THREE.MeshBasicMaterial({ color: 0x111111 });
        const plane = new THREE.Mesh(planeGeometry, planeMaterial);
        plane.rotation.x = -Math.PI / 2; // Rotate to be horizontal
        this.scene.add(plane);
        
        // Add events
        this.sizes.on('resize', () => {
            this.resize();
        });

        this.time.on('tick', () => {
            // Simple animation - move the cube back and forth instead of rotating
            if (cube) {
                cube.position.x = Math.sin(this.time.elapsed * 0.001) * 3;
            }
            this.update();
        });
    }

    resize() {
        if (this.camera && typeof this.camera.resize === 'function') {
            this.camera.resize();
        }
        
        if (this.renderer && typeof this.renderer.resize === 'function') {
            this.renderer.resize();
        }
    }

    update() {
        try {
            // Update camera
            if (this.camera && typeof this.camera.update === 'function') {
                this.camera.update();
            }
            
            // Update world components
            if (this.rcCar && typeof this.rcCar.update === 'function') {
                this.rcCar.update();
            }
            
            if (this.track && typeof this.track.update === 'function') {
                this.track.update();
            }
            
            // Update renderer
            if (this.renderer && typeof this.renderer.update === 'function') {
                this.renderer.update();
            }
        } catch (error) {
            console.error("Error in update loop:", error);
        }
    }

    destroy() {
        this.sizes.off('resize');
        this.time.off('tick');

        // Stop the debug line remover
        if (this.debugLineRemover) {
            this.debugLineRemover.stopPeriodicRemoval();
        }

        // Traverse the whole scene and dispose of everything
        this.scene.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                if (child.geometry) {
                    child.geometry.dispose();
                }
                
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(material => this.disposeMaterial(material));
                    } else {
                        this.disposeMaterial(child.material);
                    }
                }
            }
        });

        if (this.camera && this.camera.controls) {
            this.camera.controls.dispose();
        }
        
        if (this.renderer && this.renderer.instance) {
            this.renderer.instance.dispose();
        }

        if (this.debug && this.debug.active && this.debug.ui) {
            this.debug.ui.destroy();
        }
    }
    
    disposeMaterial(material) {
        if (!material) return;
        
        // Dispose all properties of the material that need disposing
        for (const key in material) {
            const value = material[key];
            if (value && typeof value.dispose === 'function') {
                value.dispose();
            }
        }
        
        material.dispose();
    }

    setCamera() {
        try {
            // Create camera
            this.camera = new Camera(this);
            
            // Adjust the far clipping plane to see more of the extended floor
            if (this.camera && this.camera.instance) {
                this.camera.instance.far = 10000;
                this.camera.instance.updateProjectionMatrix();
            }
        } catch (error) {
            console.error("Error setting up camera:", error);
        }
    }

    // Method to identify and remove red line objects
    removeRedLines() {
        console.log("Checking for red lines to remove...");
        
        this.scene.traverse((child) => {
            // Check if this is a line object with red material
            if (child instanceof THREE.Line || 
                child instanceof THREE.LineSegments || 
                child instanceof THREE.LineLoop) {
                
                console.log("Found a line object:", child);
                
                // Check if the material is red
                if (child.material && 
                    (child.material.color && 
                     (child.material.color.r === 1 && child.material.color.g === 0 && child.material.color.b === 0) ||
                     child.material.color.getHex() === 0xff0000)) {
                    console.log("Removing red line:", child);
                    this.scene.remove(child);
                }
            }
        });
    }
    
    /**
     * Helper method to adjust the F1 car height - accessible from browser console
     * Example usage: window.experience.adjustCarHeight(0.2)
     *
     * @param {number} heightOffset - Height adjustment in units (positive or negative)
     */
    adjustCarHeight(heightOffset) {
        if (this.rcCar) {
            this.rcCar.adjustCarHeight(heightOffset);
            return `Car height adjusted to offset: ${heightOffset}`;
        } else {
            return "RC Car not available yet";
        }
    }
    
    /**
     * Reset the car height to its default calculated position
     * Example usage: window.experience.resetCarHeight()
     */
    resetCarHeight() {
        if (this.rcCar) {
            this.rcCar.resetCarHeight();
            return "Car height reset to default";
        } else {
            return "RC Car not available yet";
        }
    }
} 
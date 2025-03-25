import * as THREE from 'three';

export default class Environment {
    constructor(experience) {
        this.experience = experience;
        this.scene = this.experience.scene;
        this.resources = this.experience.resources;
        this.debug = this.experience.debug;

        // Initialize lights immediately
        this.setLights();

        // Wait for resources for environment map
        this.resources.on('ready', () => {
            console.log("Resources ready in Environment");
            this.setEnvironmentMap();
        });
    }

    setEnvironmentMap() {
        try {
            this.environmentMap = {};
            this.environmentMap.intensity = 0.6;
            
            // Check if environment map is available
            if (this.resources.items.environmentMap && this.resources.items.environmentMap.isTexture) {
                this.environmentMap.texture = this.resources.items.environmentMap;
                
                // Update from encoding to colorSpace for THREE.js compatibility
                try {
                    this.environmentMap.texture.colorSpace = THREE.SRGBColorSpace;
                } catch (error) {
                    // Fallback for older THREE.js versions
                    this.environmentMap.texture.encoding = THREE.sRGBEncoding;
                    console.warn("Using legacy encoding instead of colorSpace");
                }
                
                this.scene.environment = this.environmentMap.texture;
            } else {
                console.warn('Using fallback environment, please provide proper environment maps');
                
                // Simple fallback for environment (just a color)
                this.scene.environment = null;
            }
            
            // Set background color regardless of environment map
            this.scene.background = new THREE.Color(0xffffff); // White background

            // Update all materials
            this.environmentMap.updateMaterials = () => {
                this.scene.traverse((child) => {
                    if (
                        child instanceof THREE.Mesh &&
                        child.material instanceof THREE.MeshStandardMaterial
                    ) {
                        // Only apply environment map if we have one
                        if (this.environmentMap.texture) {
                            child.material.envMap = this.environmentMap.texture;
                            child.material.envMapIntensity = this.environmentMap.intensity;
                        }
                        child.material.needsUpdate = true;
                    }
                });
            };

            this.environmentMap.updateMaterials();
        } catch (error) {
            console.error("Error setting environment map:", error);
            // Ensure background is set even if there's an error
            this.scene.background = new THREE.Color(0xffffff);
        }
    }

    setLights() {
        try {
            // Ambient light
            this.ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
            this.scene.add(this.ambientLight);

            // Directional light (sun)
            this.directionalLight = new THREE.DirectionalLight(0xffffff, 1);
            this.directionalLight.position.set(5, 5, 5);
            this.directionalLight.castShadow = true;
            this.directionalLight.shadow.mapSize.set(1024, 1024);
            this.directionalLight.shadow.camera.far = 100;
            this.directionalLight.shadow.camera.left = -50;
            this.directionalLight.shadow.camera.right = 50;
            this.directionalLight.shadow.camera.top = 50;
            this.directionalLight.shadow.camera.bottom = -50;
            this.directionalLight.shadow.normalBias = 0.05;
            this.scene.add(this.directionalLight);
            
            // Add hemisphere light for better ambient illumination
            this.hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x404040, 0.3);
            this.scene.add(this.hemisphereLight);
        } catch (error) {
            console.error("Error setting lights:", error);
            // Add a basic light as fallback
            const basicLight = new THREE.DirectionalLight(0xffffff, 1);
            basicLight.position.set(1, 1, 1);
            this.scene.add(basicLight);
            
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
            this.scene.add(ambientLight);
        }
    }
} 
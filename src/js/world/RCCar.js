import * as THREE from 'three';
import { gsap } from 'gsap';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export default class RCCar {
    constructor(experience) {
        this.experience = experience;
        this.scene = this.experience.scene;
        this.resources = this.experience.resources;
        this.time = this.experience.time;
        this.track = null; // Will be set when the track is ready
        
        this.progress = 0;
        this.speed = 0.00005;      // Reduced from 0.0004 (4x slower)
        this.manualSpeed = 0.00005; // Reduced from 0.001 (5x slower)
        
        // Control state
        this.controlMode = 'auto'; // 'auto' or 'manual'
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false
        };
        
        // Setup keyboard controls
        this.setupKeyboardControls();
        
        // Wait for resources
        this.resources.on('ready', () => {
            console.log("Resources ready in RCCar");
            this.rcCarModel = this.resources.items.rcCarModel;
            
            // If the model didn't load through resources, try direct loading
            if (!this.rcCarModel || !this.rcCarModel.scene || this.rcCarModel.scene.children.length === 0) {
                console.log("Model not loaded through resources, trying direct loading");
                this.loadModelDirectly();
            } else {
                this.setModel();
            }
            
            // Only start moving when track is available
            if (this.experience.track && this.experience.track.trackCurve) {
                this.track = this.experience.track;
                this.startMoving();
            } else {
                console.warn("Track not ready yet, waiting...");
                // Try again in a second - track might not be ready
                setTimeout(() => {
                    if (this.experience.track && this.experience.track.trackCurve) {
                        this.track = this.experience.track;
                        this.startMoving();
                    } else {
                        console.error("Track still not available, creating fallback track");
                        this.createFallbackTrack();
                        this.track = this.fallbackTrack;
                        this.startMoving();
                    }
                }, 1000);
            }
        });
    }
    
    setupKeyboardControls() {
        try {
            // Add event listeners for keyboard controls
            window.addEventListener('keydown', (event) => this.handleKeyDown(event));
            window.addEventListener('keyup', (event) => this.handleKeyUp(event));
            
            // Create instructions element
            this.createControlsInfo();
            
            console.log("Keyboard controls set up");
        } catch (error) {
            console.error("Error setting up keyboard controls:", error);
        }
    }
    
    createControlsInfo() {
        // Create a controls info div
        const controlsInfo = document.createElement('div');
        controlsInfo.className = 'controls-info';
        controlsInfo.innerHTML = `
            <h3>Controls</h3>
            <div>Arrow Keys: Control Car</div>
            <div>Space: Toggle Auto/Manual</div>
            <div class="mode">Mode: Automatic</div>
        `;
        
        // Style the controls info
        controlsInfo.style.position = 'absolute';
        controlsInfo.style.bottom = '20px';
        controlsInfo.style.left = '20px';
        controlsInfo.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        controlsInfo.style.color = 'white';
        controlsInfo.style.padding = '10px';
        controlsInfo.style.borderRadius = '5px';
        controlsInfo.style.fontFamily = 'Arial, sans-serif';
        controlsInfo.style.zIndex = '1000';
        
        // Add the controls info to the body
        document.body.appendChild(controlsInfo);
        
        // Save reference to mode display
        this.modeDisplay = controlsInfo.querySelector('.mode');
    }
    
    handleKeyDown(event) {
        // Check which key was pressed
        switch(event.key) {
            case 'ArrowUp':
                this.keys.forward = true;
                this.setControlMode('manual');
                break;
            case 'ArrowDown':
                this.keys.backward = true;
                this.setControlMode('manual');
                break;
            case 'ArrowLeft':
                this.keys.left = true;
                this.setControlMode('manual');
                break;
            case 'ArrowRight':
                this.keys.right = true;
                this.setControlMode('manual');
                break;
            case ' ': // Spacebar
                // Toggle between auto and manual modes
                this.setControlMode(this.controlMode === 'auto' ? 'manual' : 'auto');
                break;
        }
    }
    
    handleKeyUp(event) {
        // Check which key was released
        switch(event.key) {
            case 'ArrowUp':
                this.keys.forward = false;
                break;
            case 'ArrowDown':
                this.keys.backward = false;
                break;
            case 'ArrowLeft':
                this.keys.left = false;
                break;
            case 'ArrowRight':
                this.keys.right = false;
                break;
        }
    }
    
    setControlMode(mode) {
        this.controlMode = mode;
        
        // Update mode display if it exists
        if (this.modeDisplay) {
            this.modeDisplay.textContent = `Mode: ${this.controlMode === 'auto' ? 'Automatic' : 'Manual'}`;
        }
        
        console.log(`Control mode set to: ${this.controlMode}`);
    }
    
    createFallbackTrack() {
        console.log("Creating fallback track");
        // Create a simple circular path as fallback
        this.fallbackTrack = {
            trackCurve: new THREE.CurvePath(),
            trackCurvePoints: []
        };
        
        // Create a circle with radius 10
        const radius = 10;
        const points = 100;
        const circle = [];
        
        for (let i = 0; i <= points; i++) {
            const angle = (i / points) * Math.PI * 2;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            circle.push(new THREE.Vector3(x, 0, z));
        }
        
        // Create a curve from points
        const curve = new THREE.CatmullRomCurve3(circle);
        this.fallbackTrack.trackCurve = curve;
        this.fallbackTrack.getPointAt = (t) => curve.getPointAt(t);
        this.fallbackTrack.getTangentAt = (t) => curve.getTangentAt(t);
    }
    
    setModel() {
        try {
            // Check if we have a valid model, otherwise create a simple box placeholder
            if (this.rcCarModel && this.rcCarModel.scene && this.rcCarModel.scene.children.length > 0) {
                console.log("Using F1 car GLB model");
                this.debugModelStructure(); // Add debug output
                
                this.model = this.rcCarModel.scene;
                
                // Check if model is valid
                if (!this.model) {
                    console.error("Model scene is invalid, using fallback");
                    this.createFallbackModel();
                    return;
                }
                
                console.log("F1 model loaded successfully, configuring...");
                
                // Appropriate scale for F1 car model - may need adjustment based on actual model size
                this.model.scale.set(0.25, 0.25, 0.25);
                
                // Centered on origin - will be positioned by carGroup
                this.model.position.set(0, 0, 0);
                
                // Rotate the model to face forward direction
                this.model.rotation.set(0, Math.PI, 0);
                
                // Create a bounding box to measure the model height for proper alignment
                const boundingBox = new THREE.Box3().setFromObject(this.model);
                const modelHeight = boundingBox.max.y - boundingBox.min.y;
                const groundOffset = boundingBox.min.y;
                
                console.log("F1 car model dimensions:", {
                    width: boundingBox.max.x - boundingBox.min.x,
                    height: modelHeight,
                    depth: boundingBox.max.z - boundingBox.min.z,
                    groundOffset: groundOffset,
                    min: boundingBox.min,
                    max: boundingBox.max
                });
                
                // Store model measurements for positioning on track later
                this.modelGroundOffset = groundOffset;
                
                // Apply shadows to the model
                this.model.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        console.log(`Mesh found in model: ${child.name}`);
                        child.castShadow = true;
                        child.receiveShadow = true;
                        
                        // Improve material quality
                        if (child.material) {
                            console.log(`Material found on ${child.name}:`, child.material.type);
                            child.material.metalness = 0.7; // Higher metalness for car body
                            child.material.roughness = 0.3; // Lower roughness for shinier look
                            
                            // Ensure correct texture encoding if textures are present
                            if (child.material.map) {
                                try {
                                    child.material.map.colorSpace = THREE.SRGBColorSpace;
                                } catch (error) {
                                    // Fallback for older THREE.js versions
                                    child.material.map.encoding = THREE.sRGBEncoding;
                                    console.warn("Using legacy encoding instead of colorSpace for texture");
                                }
                            }
                        }
                    }
                });
                
                // Try to find the wheels for animation
                this.wheels = [];
                this.model.traverse((child) => {
                    // Look for wheels by name patterns common in F1 car models
                    if (child.name && (
                        child.name.toLowerCase().includes('wheel') || 
                        child.name.toLowerCase().includes('tire') ||
                        child.name.toLowerCase().includes('tyre') ||
                        child.name.toLowerCase().includes('rim')
                    )) {
                        console.log("Found wheel:", child.name);
                        this.wheels.push(child);
                    }
                });
                
                // If no wheels found by name, try to find by geometry
                if (this.wheels.length === 0) {
                    console.log("No wheels found by name, trying to find by geometry");
                    this.findWheelsByGeometry();
                }
                
                console.log(`Found ${this.wheels.length} wheels in the F1 car model`);
            } else {
                console.warn("Invalid or missing F1 car model, using fallback");
                this.createFallbackModel();
            }
            
            // Add the model to the scene
            this.scene.add(this.model);
            
            // Create a group to handle car rotation
            this.carGroup = new THREE.Group();
            this.scene.add(this.carGroup);
            this.carGroup.add(this.model);
            
            console.log(`Car model set up with ${this.wheels.length} wheels`);
        } catch (error) {
            console.error("Error setting up model:", error);
            this.createFallbackModel();
        }
    }
    
    findWheelsByGeometry() {
        // Try to find wheels by looking for round shapes
        // This is a fallback if wheels aren't properly named in the model
        const potentialWheels = [];
        
        this.model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                // Check if the object is roughly cylindrical
                if (child.geometry && 
                    (child.geometry.type === 'CylinderGeometry' || 
                     child.geometry.type === 'CylinderBufferGeometry')) {
                    potentialWheels.push(child);
                }
                
                // For BufferGeometry, try to detect wheels by their shape and position
                if (child.geometry && child.geometry.type === 'BufferGeometry') {
                    // Look for objects that are roughly the same height
                    // and are near the bottom of the car
                    if (child.position.y < 0.5) {
                        potentialWheels.push(child);
                    }
                }
            }
        });
        
        // If we found potential wheels, use them
        if (potentialWheels.length >= 4) {
            console.log(`Found ${potentialWheels.length} potential wheels by geometry`);
            this.wheels = potentialWheels;
        }
    }
    
    startMoving() {
        try {
            // Begin animation on the path when track is ready
            if (this.track && this.track.trackCurve) {
                console.log("Starting car movement on track");
                // Get initial position on the track
                const initialPosition = this.track.getPointAt(0);
                this.carGroup.position.copy(initialPosition);
                
                // Get initial direction
                const initialTangent = this.track.getTangentAt(0);
                this.carGroup.lookAt(
                    initialPosition.x + initialTangent.x,
                    initialPosition.y + initialTangent.y,
                    initialPosition.z + initialTangent.z
                );
            } else {
                console.error("Cannot start movement - track not available");
            }
        } catch (error) {
            console.error("Error starting movement:", error);
        }
    }
    
    updateAutoMovement() {
        // Increment progress
        this.progress += this.speed * this.time.delta;
        
        // Ensure progress wraps around between 0 and 1
        if (this.progress > 1) {
            this.progress -= 1;
        } else if (this.progress < 0) {
            this.progress += 1;
        }
        
        // Get position on track
        const position = this.track.getPointAt(this.progress);
        if (position) {
            this.carGroup.position.copy(position);
            
            // Position the car correctly on the track surface
            // Include any height adjustment set via adjustCarHeight method
            const heightAdjustment = this.heightAdjustment || 0;
            
            // If we have detected the model's ground offset, use that for precise positioning
            if (this.modelGroundOffset !== undefined) {
                // Adjust height to make the model sit exactly on the surface
                // Using a smaller buffer to position the car closer to the ground
                const groundBuffer = 0.01; // Reduced from 0.05 to get car closer to ground
                this.carGroup.position.y = Math.abs(this.modelGroundOffset) * 0.5 + groundBuffer + heightAdjustment;
            } else {
                // Fallback to default positioning if no offset was measured
                this.carGroup.position.y = 0.01 + heightAdjustment; // Reduced from 0.05
            }
            
            // Get the tangent at the current position (direction of movement)
            const tangent = this.track.getTangentAt(this.progress);
            
            // Make the car look in the direction of motion
            if (tangent) {
                const target = new THREE.Vector3(
                    position.x + tangent.x,
                    position.y + tangent.y,
                    position.z + tangent.z
                );
                this.carGroup.lookAt(target);
            }
        }
    }
    
    updateManualMovement() {
        let progressChange = 0;
        
        // Calculate progress change based on input
        if (this.keys.forward) {
            progressChange += this.manualSpeed * this.time.delta;
        }
        if (this.keys.backward) {
            progressChange -= this.manualSpeed * this.time.delta;
        }
        
        // Update progress
        this.progress += progressChange;
        
        // Ensure progress wraps around between 0 and 1
        if (this.progress > 1) {
            this.progress -= 1;
        } else if (this.progress < 0) {
            this.progress += 1;
        }
        
        // Get position on track
        const position = this.track.getPointAt(this.progress);
        if (position) {
            this.carGroup.position.copy(position);
            
            // Position the car correctly on the track surface
            // Include any height adjustment set via adjustCarHeight method
            const heightAdjustment = this.heightAdjustment || 0;
            
            // If we have detected the model's ground offset, use that for precise positioning
            if (this.modelGroundOffset !== undefined) {
                // Adjust height to make the model sit exactly on the surface
                // Using a smaller buffer to position the car closer to the ground
                const groundBuffer = 0.01; // Reduced from 0.05 to get car closer to ground
                this.carGroup.position.y = Math.abs(this.modelGroundOffset) * 0.5 + groundBuffer + heightAdjustment;
            } else {
                // Fallback to default positioning if no offset was measured
                this.carGroup.position.y = 0.01 + heightAdjustment; // Reduced from 0.05
            }
            
            // Get the tangent at the current position (direction of movement)
            const tangent = this.track.getTangentAt(this.progress);
            
            // Make the car look in the direction of motion
            if (tangent) {
                const target = new THREE.Vector3(
                    position.x + tangent.x,
                    position.y + tangent.y,
                    position.z + tangent.z
                );
                this.carGroup.lookAt(target);
                
                // Add steer effect based on left/right keys
                let steerAngle = 0;
                if (this.keys.left) steerAngle = Math.PI * 0.05;
                if (this.keys.right) steerAngle = -Math.PI * 0.05;
                
                if (steerAngle !== 0) {
                    const steerMatrix = new THREE.Matrix4().makeRotationY(steerAngle);
                    const currentDirection = new THREE.Vector3(0, 0, 1).applyQuaternion(this.carGroup.quaternion);
                    currentDirection.applyMatrix4(steerMatrix);
                    
                    // Create temporary vector for lookAt
                    const lookPoint = this.carGroup.position.clone().add(currentDirection);
                    this.carGroup.lookAt(lookPoint);
                    
                    // Adjust progress based on steering
                    if (progressChange !== 0) {
                        if (this.keys.left) this.progress += 0.0001 * this.time.delta;
                        if (this.keys.right) this.progress -= 0.0001 * this.time.delta;
                    }
                }
            }
        }
    }
    
    update() {
        try {
            if (this.track && this.track.trackCurve && this.carGroup) {
                // Update movement based on control mode
                if (this.controlMode === 'auto') {
                    this.updateAutoMovement();
                } else {
                    this.updateManualMovement();
                }
                
                // Removed wheel animation - wheels no longer rotate
                // Wheels are now fixed in position
            }
        } catch (error) {
            console.error("Error updating car position:", error);
        }
    }
    
    debugModelStructure() {
        if (!this.rcCarModel || !this.rcCarModel.scene) {
            console.log("No model to debug");
            return;
        }
        
        console.log("RC Car Model Structure:");
        console.log("Total children:", this.rcCarModel.scene.children.length);
        
        // Function to recursively print the structure
        const printStructure = (object, indent = 0) => {
            const indentStr = ' '.repeat(indent * 2);
            const objectType = object.type;
            const objectName = object.name || '[unnamed]';
            
            console.log(`${indentStr}- ${objectName} (${objectType})`);
            
            if (object instanceof THREE.Mesh) {
                const matType = object.material ? object.material.type : 'unknown';
                const geoType = object.geometry ? object.geometry.type : 'unknown';
                console.log(`${indentStr}  Mesh details: material=${matType}, geometry=${geoType}`);
                
                // Check if this looks like a wheel
                if (objectName.toLowerCase().includes('wheel') || 
                    objectName.toLowerCase().includes('tire')) {
                    console.log(`${indentStr}  POTENTIAL WHEEL FOUND`);
                }
            }
            
            // Recursively print children
            if (object.children && object.children.length > 0) {
                for (const child of object.children) {
                    printStructure(child, indent + 1);
                }
            }
        };
        
        // Start with scene's children
        for (const child of this.rcCarModel.scene.children) {
            printStructure(child);
        }
    }
    
    /**
     * Adjust the height of the car model - can be called from console for fine-tuning
     * @param {number} heightOffset - Additional height offset in units
     */
    adjustCarHeight(heightOffset) {
        // Store the adjustment value
        this.heightAdjustment = heightOffset || 0;
        
        // Apply immediately to current position
        if (this.modelGroundOffset !== undefined) {
            // Use the model's measured ground offset with the adjustment
            const newHeight = Math.abs(this.modelGroundOffset) * 0.5 + this.heightAdjustment;
            this.carGroup.position.y = newHeight;
            console.log(`Car height adjusted to: ${newHeight}`);
        } else {
            // Just apply the adjustment to the default height
            const newHeight = 0.01 + this.heightAdjustment;
            this.carGroup.position.y = newHeight;
            console.log(`Car height adjusted to: ${newHeight} (using default positioning)`);
        }
        
        return this; // For chaining
    }
    
    /**
     * Reset the height adjustment to default
     */
    resetCarHeight() {
        this.heightAdjustment = 0;
        
        if (this.modelGroundOffset !== undefined) {
            this.carGroup.position.y = Math.abs(this.modelGroundOffset) * 0.5;
        } else {
            this.carGroup.position.y = 0.01;
        }
        
        console.log("Car height reset to default");
        return this; // For chaining
    }
    
    /**
     * Create a fallback model when the F1 car model fails to load
     */
    createFallbackModel() {
        console.log("Creating fallback car model");
        
        // Create a simple car shape as fallback
        this.model = new THREE.Group();
        
        // Car body - use a blue color for visibility
        const bodyGeometry = new THREE.BoxGeometry(1, 0.5, 2);
        const bodyMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x3344aa,
            metalness: 0.3,
            roughness: 0.4
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.castShadow = true;
        body.receiveShadow = true;
        this.model.add(body);
        
        // Wheels
        const wheelGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 16);
        const wheelMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x222222,
            metalness: 0.3,
            roughness: 0.8
        });
        
        // Create and position wheels
        this.wheels = [];
        const wheelPositions = [
            { x: -0.6, y: -0.25, z: 0.7 },  // front left
            { x: 0.6, y: -0.25, z: 0.7 },   // front right
            { x: -0.6, y: -0.25, z: -0.7 }, // back left
            { x: 0.6, y: -0.25, z: -0.7 }   // back right
        ];
        
        wheelPositions.forEach(pos => {
            const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
            wheel.position.set(pos.x, pos.y, pos.z);
            wheel.rotation.z = Math.PI / 2; // Rotate to correct orientation
            wheel.castShadow = true;
            wheel.receiveShadow = true;
            this.model.add(wheel);
            this.wheels.push(wheel);
        });
    }
    
    /**
     * Load the F1 model directly using GLTFLoader
     */
    loadModelDirectly() {
        console.log("Attempting to load F1 model directly");
        
        // Create a new loader instance
        const loader = new GLTFLoader();
        
        // Try multiple paths to find the correct one
        const paths = [
            './models/rc_f1.glb',
            '/models/rc_f1.glb',
            '../models/rc_f1.glb',
            'models/rc_f1.glb',
            '/dist/models/rc_f1.glb',
            './dist/models/rc_f1.glb',
            window.location.origin + '/models/rc_f1.glb',
            window.location.origin + '/dist/models/rc_f1.glb'
        ];
        
        // Try loading from each path
        let loadAttempts = 0;
        
        const tryNextPath = (index) => {
            if (index >= paths.length) {
                console.error("Failed to load F1 model from any path");
                this.setModel(); // Use fallback
                return;
            }
            
            const path = paths[index];
            console.log(`Trying to load F1 model from: ${path}`);
            
            loader.load(
                path,
                (gltf) => {
                    console.log(`Successfully loaded F1 model from: ${path}`, gltf);
                    this.rcCarModel = gltf;
                    this.setModel();
                },
                (progress) => {
                    // Log progress for larger files
                    if (progress.loaded && progress.total) {
                        const percent = Math.round((progress.loaded / progress.total) * 100);
                        if (percent % 25 === 0) { // Log at 0%, 25%, 50%, 75%, 100%
                            console.log(`Loading F1 model: ${percent}% (${progress.loaded}/${progress.total})`);
                        }
                    }
                },
                (error) => {
                    console.warn(`Failed to load from ${path}:`, error);
                    loadAttempts++;
                    // Try the next path
                    tryNextPath(index + 1);
                }
            );
        };
        
        // Start trying paths
        tryNextPath(0);
    }
} 
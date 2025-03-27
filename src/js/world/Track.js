import * as THREE from 'three';

export default class Track {
    constructor(experience) {
        this.experience = experience;
        this.scene = this.experience.scene;
        this.resources = this.experience.resources;
        this.time = this.experience.time;

        // Initialize immediately even before resources are ready
        this.createTrack();

        // Wait for resources for textures and signs
        this.resources.on('ready', () => {
            console.log("Resources ready in Track");
            this.applyTrackTexture();
            this.createSigns();
        });
    }

    createTrack() {
        try {
            // Generate racing track pattern
            const trackOuterRadius = 27.5; // Adjusted to match the visual track (was 30)
            const trackInnerRadius = 25;
            const trackSegments = 64;
            const trackPoints = [];
            
            // Create a torus-like shape for the track
            for (let i = 0; i <= trackSegments; i++) {
                const angle = (i / trackSegments) * Math.PI * 2;
                const x = Math.cos(angle) * trackOuterRadius;
                const z = Math.sin(angle) * trackOuterRadius;
                trackPoints.push(new THREE.Vector3(x, 0, z));
            }
            
            // Create a curve for car movement
            this.trackCurve = new THREE.CatmullRomCurve3(trackPoints, true);
            
            // Disable curve visualization to avoid red debug lines - more aggressive approach
            if (this.trackCurve) {
                if (this.trackCurve.updateArcLengths) {
                    this.trackCurve.updateArcLengths();
                }
                
                // Override any methods that might create debug lines
                ['createDebugVisualization', 'createLineGeometry', 'createPointsGeometry'].forEach(methodName => {
                    if (typeof this.trackCurve[methodName] === 'function') {
                        this.trackCurve[methodName] = function() { return null; };
                    }
                });
            }
            
            // Create track visuals - still using original radii for visuals
            this.createTrackVisuals(30, 25);
            
            // Store points for the car to follow
            this.trackPathPoints = trackPoints;
            
            // Remove any existing red lines in the scene (immediate cleanup)
            this.removeDebugLines();
        } catch (error) {
            console.error("Error creating track geometry:", error);
            // Create a fallback track (simple circle)
            this.createFallbackTrack();
        }
    }
    
    createTrackVisuals(outerRadius, innerRadius) {
        // Create a very large plane for the background floor
        const gridSize = 10000;
        const planeGeometry = new THREE.PlaneGeometry(gridSize, gridSize, 32, 32);
        const planeMaterial = new THREE.MeshStandardMaterial({
            color: 0x222222, // Dark grey background
            metalness: 0.3,
            roughness: 0.8,
            side: THREE.DoubleSide
        });
        
        // Create and position the floor
        this.trackPlane = new THREE.Mesh(planeGeometry, planeMaterial);
        this.trackPlane.rotation.x = -Math.PI / 2;
        this.trackPlane.receiveShadow = true;
        this.scene.add(this.trackPlane);
        
        // Create the actual grey track (ring shape)
        const trackWidth = outerRadius - innerRadius;
        const trackRingGeometry = new THREE.RingGeometry(innerRadius, outerRadius, 128, 1);
        const trackMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333, // Very dark grey track (changed from 0x666666)
            metalness: 0.2,
            roughness: 0.8,
            side: THREE.DoubleSide
        });
        
        this.trackRing = new THREE.Mesh(trackRingGeometry, trackMaterial);
        this.trackRing.rotation.x = -Math.PI / 2;
        this.trackRing.position.y = 0.01; // Slightly above floor to avoid z-fighting
        this.trackRing.receiveShadow = true;
        this.scene.add(this.trackRing);
        
        // Create white lines on the track - center, inner edge, and outer edge
        const centerRadius = outerRadius - (trackWidth / 2);
        this.createDottedLine(centerRadius, 0.05); // Dotted center line
        this.createTrackLine(innerRadius + 0.1, 0.08, 'inner'); // Thicker inner edge line
        this.createTrackLine(outerRadius - 0.1, 0.08, 'outer'); // Thicker outer edge line
        
        // Store materials for later texture application
        this.planeMaterial = planeMaterial;
        this.trackMaterial = trackMaterial;
    }
    
    createTrackLine(radius, tubeRadius, lineType) {
        // Create a line that follows a circle at the specified radius
        const linePoints = [];
        const lineSegments = 128; // More segments for smoother circle
        
        // Create points for a complete circle
        for (let i = 0; i <= lineSegments; i++) {
            const angle = (i / lineSegments) * Math.PI * 2;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            linePoints.push(new THREE.Vector3(x, 0, z));
        }
        
        // Create a curve from the points
        const curve = new THREE.CatmullRomCurve3(linePoints);
        
        // Add a tube geometry for a visible line
        const tubeGeometry = new THREE.TubeGeometry(
            curve,
            256,          // tubularSegments
            tubeRadius,   // radius of tube
            8,            // radialSegments
            false         // closed
        );
        
        const tubeMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xFFFFFF // Pure white
        });
        
        const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
        tube.position.y = 0.02; // Slightly above track
        tube.userData.isIntentional = true; // Flag to prevent removal
        tube.userData.lineType = lineType; // Track which line this is
        this.scene.add(tube);
        
        // Store references based on line type
        if (lineType === 'center') {
            this.centerTube = tube;
        } else if (lineType === 'inner') {
            this.innerTube = tube;
        } else if (lineType === 'outer') {
            this.outerTube = tube;
        }
        
        return tube;
    }
    
    createDottedLine(radius, dashWidth) {
        // Create a dotted/dashed line around the specified radius
        const segments = 64; // Number of segments around the circle
        const dashesGroup = new THREE.Group();
        this.scene.add(dashesGroup);
        
        // Calculate the circumference
        const circumference = 2 * Math.PI * radius;
        
        // Calculate how many dashes we want
        const dashLength = 1.0; // Length of each dash
        const gapLength = 1.0;  // Length of gap between dashes
        const totalDashes = Math.floor(circumference / (dashLength + gapLength));
        
        // Create each dash segment
        for (let i = 0; i < totalDashes; i++) {
            // Calculate start and end angles for this dash
            const startPercent = i / totalDashes;
            const endPercent = (i + (dashLength / (dashLength + gapLength))) / totalDashes;
            
            if (endPercent > 1) continue; // Skip if we're past a full circle
            
            const startAngle = startPercent * Math.PI * 2;
            const endAngle = endPercent * Math.PI * 2;
            
            // Create arc points for this dash
            const arcPoints = [];
            const arcSegments = 10;
            
            for (let j = 0; j <= arcSegments; j++) {
                const t = j / arcSegments;
                const angle = startAngle + (endAngle - startAngle) * t;
                const x = Math.cos(angle) * radius;
                const z = Math.sin(angle) * radius;
                arcPoints.push(new THREE.Vector3(x, 0, z));
            }
            
            // Create curve and tube for this dash
            const curve = new THREE.CatmullRomCurve3(arcPoints);
            const tubeGeometry = new THREE.TubeGeometry(
                curve,
                10,         // tubularSegments
                dashWidth,  // radius
                8,          // radialSegments
                false       // closed
            );
            
            const tubeMaterial = new THREE.MeshBasicMaterial({ 
                color: 0xFFFFFF // White
            });
            
            const dashTube = new THREE.Mesh(tubeGeometry, tubeMaterial);
            dashTube.position.y = 0.02; // Slightly above track
            dashTube.userData.isIntentional = true;
            dashTube.userData.isDash = true;
            
            dashesGroup.add(dashTube);
        }
        
        // Store reference to dash group
        this.centerDashes = dashesGroup;
        
        return dashesGroup;
    }
    
    createFallbackTrack() {
        console.log("Creating fallback track geometry");
        // Create a circle with radius 20
        const radius = 20;
        const points = 100;
        const circle = [];
        
        for (let i = 0; i <= points; i++) {
            const angle = (i / points) * Math.PI * 2;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            circle.push(new THREE.Vector3(x, 0, z));
        }
        
        // Create a curve from points
        this.trackCurve = new THREE.CatmullRomCurve3(circle);
        
        // Disable curve visualization
        if (this.trackCurve && this.trackCurve.updateArcLengths) {
            this.trackCurve.updateArcLengths();
        }
        
        // Create basic track visuals
        this.createTrackVisuals(radius, radius - 5);
    }
    
    applyTrackTexture() {
        // If we're using procedural track visuals, we don't need additional textures
        console.log("Using procedural track visuals instead of textures");
    }
    
    createSigns() {
        try {
            // We'll create 8 billboards around the track
            const billboardScaleFactor = 1.25; // 25% larger circle than the track
            
            // Get position vectors at even intervals around the track
            const basePositions = [
                this.getPointAt(0),       // Position at 0% 
                this.getPointAt(0.125),   // Position at 12.5%
                this.getPointAt(0.25),    // Position at 25%
                this.getPointAt(0.375),   // Position at 37.5%
                this.getPointAt(0.5),     // Position at 50%
                this.getPointAt(0.625),   // Position at 62.5%
                this.getPointAt(0.75),    // Position at 75%
                this.getPointAt(0.875)    // Position at 87.5%
            ];
            
            // Scale the positions outward from center to create a larger circle
            const signPositions = basePositions.map(pos => {
                // Direction vector from origin to position (on xz plane)
                const dir = new THREE.Vector3(pos.x, 0, pos.z).normalize();
                // Scale outward by the specified factor
                return new THREE.Vector3(
                    pos.x + (dir.x * 5), // Add 5 units in the direction away from center
                    pos.y,                // Keep same height
                    pos.z + (dir.z * 5)   // Add 5 units in the direction away from center
                );
            });
            
            // Sign colors for materials - original 4 plus 4 new ones
            const signColors = [
                '#0000ff', // Blue (R)
                '#00ff00', // Green (A)
                '#800080', // Purple (XYZ)
                '#FFA500', // Orange (C)
                '#ff0000', // Red (XY)
                '#FF69B4', // Pink (E)
                '#00ff00', // Green (WAVE)
                '#FFFF00'  // Yellow (T)
            ];
            
            // Fixed absolute angle offsets for each sign to ensure consistent facing
            // Each sign will face exactly inward toward the center
            const signAngles = [
                Math.PI/1,          // 0% - facing east (then flipped to west/inward)
                Math.PI/1.32,   // 12.5% - facing northeast (then flipped to southwest/inward)
                Math.PI/2,   // 25% - facing north (then flipped to south/inward)
                3*Math.PI/2, // 37.5% - facing northwest (then flipped to southeast/inward)
                Math.PI,     // 50% - facing west (then flipped to east/inward)
                5*Math.PI/2, // 62.5% - facing southwest (then flipped to northeast/inward)
                3*Math.PI/2, // 75% - facing south (then flipped to north/inward)
                7*Math.PI/4  // 87.5% - facing southeast (then flipped to northwest/inward)
            ];
            
            // Individual rotation adjustments for fine-tuning each billboard
            // Values are in radians, positive values rotate clockwise
            const rotationAdjustments = [
                0,                  // Billboard 0 (0%) - no adjustment
                0,                  // Billboard 1 (12.5%) - no adjustment
                0,                  // Billboard 2 (25%) - no adjustment
                -Math.PI,           // Billboard 3 (37.5%) - adjust to face southeast
                -Math.PI,           // Billboard 4 (50%) - adjust to face east
                -Math.PI,           // Billboard 5 (62.5%) - adjust to face west
                -Math.PI/0.1,           // Billboard 6 (75%) - adjust to face south
                -Math.PI/2          // Billboard 7 (87.5%) - adjust to face west
            ];
            
            // Project descriptions for each billboard (3 lines each)
            const projectDescriptions = [
                // Billboard 0 - Blue (R)
                [
                    "Virtual Reality Racing Simulator",
                    "Built with Unreal Engine 5",
                    "Features realistic physics and weather"
                ],
                // Billboard 1 - Green (A)
                [
                    "AI-Powered Traffic Analysis",
                    "Python backend with neural networks",
                    "Reduced urban congestion by 32%"
                ],
                // Billboard 2 - Purple (XYZ)
                [
                    "3D Geological Mapping Platform",
                    "WebGL implementation with terrain data",
                    "Used by research institutes worldwide"
                ],
                // Billboard 3 - Orange (C)
                [
                    "Connected Cities Initiative",
                    "IoT sensors and real-time analytics",
                    "Deployed in 12 major urban centers"
                ],
                // Billboard 4 - Red (XY)
                [
                    "Autonomous Drone Navigation",
                    "Computer vision and path optimization",
                    "99.8% success rate in field tests"
                ],
                // Billboard 5 - Pink (E)
                [
                    "Educational Augmented Reality",
                    "Interactive science curriculum",
                    "Adopted by 200+ schools nationally"
                ],
                // Billboard 6 - Green (WAVE)
                [
                    "Wave Energy Visualization Tool",
                    "Hydrodynamic simulations in real-time",
                    "Contributed to 3 renewable energy projects"
                ],
                // Billboard 7 - Yellow (T)
                [
                    "Transportation Network Optimizer",
                    "Graph algorithms and machine learning",
                    "Improved efficiency by 27% in pilot city"
                ]
            ];
            
            // Check if we have the billboard model
            if (!this.resources.items.billboardModel) {
                console.error("Billboard model not loaded!");
                return;
            }
            
            this.signs = [];
            this.projectTexts = [];
            
            // Get the billboard model
            const billboardModel = this.resources.items.billboardModel;
            
            // Create project descriptions text on the opposite side of each billboard
            for (let i = 0; i < basePositions.length; i++) {
                // Use a smaller inner radius for the text (inside the track circle)
                const innerRadius = 18; // Slightly larger to be more visible
                
                // Calculate position using the same angle as the billboards
                const angle = i * Math.PI/4; // 8 evenly spaced positions
                const textPosition = new THREE.Vector3(
                    Math.cos(angle) * innerRadius,
                    0.05, // Raised slightly higher for better visibility
                    Math.sin(angle) * innerRadius
                );
                
                // Create a group for the text elements
                const textGroup = new THREE.Group();
                this.scene.add(textGroup);
                textGroup.position.copy(textPosition);
                
                // Individual text rotation adjustments (initialized to standard values)
                const textRotationAdjustments = [
                    Math.PI/1,              // Text 0 - no adjustment
                    0,              // Text 1 - no adjustment 
                    0,              // Text 2 - no adjustment
                    Math.PI,        // Text 3 - flip 180 degrees
                    Math.PI,        // Text 4 - flip 180 degrees
                    Math.PI,        // Text 5 - flip 180 degrees
                    Math.PI,        // Text 6 - flip 180 degrees
                    Math.PI/2       // Text 7 - rotate 90 degrees
                ];
                
                // Rotate text to face correctly toward its billboard,
                // applying the individual adjustment for this text element
                textGroup.rotation.y = angle + textRotationAdjustments[i];
                
                // Create a single text mesh with all lines
                // Create 2-3 sentences with one line per sentence
                let combinedText;
                if (projectDescriptions[i].length >= 3) {
                    combinedText = 
                        projectDescriptions[i][0] + "\n\n" + 
                        projectDescriptions[i][1] + "\n\n" + 
                        projectDescriptions[i][2];
                } else {
                    combinedText = 
                        projectDescriptions[i][0] + "\n\n" + 
                        projectDescriptions[i][1];
                }
                
                const text = this.createCombinedTextMesh(
                    combinedText, 
                    0xFFFFFF, // White color
                    1.0 // Keep the large text scale
                );
                
                // Rotate the text to lie at an angle tilted toward the viewer
                // Instead of perfectly flat (-Math.PI/2 or 90 degrees), 
                // we use a smaller angle like -Math.PI/3 (60 degrees) to tilt it toward the viewer
                text.rotation.x = -Math.PI/3; // Tilted up by 30 degrees from horizontal
                
                textGroup.add(text);
                
                this.projectTexts.push(textGroup);
            }
            
            // Add method to window object for runtime adjustment of text rotations
            window.adjustTextRotation = (index, angle) => {
                if (this.projectTexts && this.projectTexts[index]) {
                    // Convert degrees to radians for easier use from console
                    const radians = angle * (Math.PI / 180);
                    const baseAngle = index * Math.PI/4; // Base angle based on position
                    this.projectTexts[index].rotation.y = baseAngle + radians;
                    console.log(`Adjusted text ${index} rotation to base angle + ${angle} degrees (${radians.toFixed(4)} radians)`);
                    return `Text ${index} adjusted`;
                } else {
                    console.error(`Text at index ${index} not found`);
                    return "Text not found";
                }
            };
            
            // For each position, create a billboard
            for (let i = 0; i < signPositions.length; i++) {
                // Clone the billboard model for each position
                const billboard = billboardModel.scene.clone();
                
                // Create a group to handle rotation properly
                const billboardGroup = new THREE.Group();
                this.scene.add(billboardGroup);
                
                // Position the group at the sign position
                billboardGroup.position.copy(signPositions[i]);
                
                // Add the billboard to the group
                billboardGroup.add(billboard);
                
                // Apply scale - adjust these values to change billboard size
                billboard.scale.set(0.8, 0.8, 0.8);
                
                // Make the billboard face inward toward the track
                // Apply the base angle plus any individual adjustment
                billboardGroup.rotation.y = signAngles[i] + rotationAdjustments[i];
                
                // Apply texture to the billboard (find the material and change its color)
                billboard.traverse((child) => {
                    if (child.isMesh && child.material) {
                        // If the mesh has a name indicating it's the sign part
                        if (child.name.includes('SignPanel') || child.name.includes('Screen')) {
                            // Use solid colors as the most reliable approach
                            const solidColor = new THREE.Color(signColors[i]);
                            child.material = new THREE.MeshStandardMaterial({
                                color: solidColor,
                                metalness: 0.3,
                                roughness: 0.4,
                                emissive: solidColor,
                                emissiveIntensity: 0.2
                            });
                            
                            // Force material update
                            child.material.needsUpdate = true;
                            
                            // Log for debugging
                            console.log(`Applied solid color to billboard ${i}: ${signColors[i]}`);
                        }
                        
                        // Make sure shadows work
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                
                // Store reference to the group
                this.signs.push(billboardGroup);
            }
            
            console.log(`Created ${this.signs.length} billboard models around the track`);
            console.log(`Added ${this.projectTexts.length} project descriptions on the inner track`);
            console.log("Use window.adjustTextRotation(index, angleDegrees) to adjust individual text rotations");
            
            // Add method to window object for runtime adjustment of billboards
            window.adjustBillboardRotation = (index, angle) => {
                if (this.signs && this.signs[index]) {
                    // Convert degrees to radians for easier use from console
                    const radians = angle * (Math.PI / 180);
                    this.signs[index].rotation.y = signAngles[index] + radians;
                    console.log(`Adjusted billboard ${index} rotation to ${angle} degrees (${radians.toFixed(4)} radians)`);
                    return `Billboard ${index} adjusted`;
                } else {
                    console.error(`Billboard at index ${index} not found`);
                    return "Billboard not found";
                }
            };
            
            console.log("Use window.adjustBillboardRotation(index, angleDegrees) to adjust individual billboards");
        } catch (error) {
            console.error("Error creating billboards:", error);
        }
    }
    
    // Helper method to create 3D text meshes
    createTextMesh(text, color, scale = 1, yOffset = 0) {
        // Create a canvas to generate texture
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 1024; 
        canvas.height = 256;
        
        // Clear canvas with a semi-transparent black background for better contrast
        context.fillStyle = 'rgba(0, 0, 0, 0.7)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add white border
        context.strokeStyle = '#ffffff';
        context.lineWidth = 8;
        context.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
        
        // Set text properties
        context.font = 'bold 96px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillStyle = '#ffffff';
        
        // Add text shadow for better visibility
        context.shadowColor = 'rgba(0, 0, 0, 0.7)';
        context.shadowBlur = 7;
        context.shadowOffsetX = 3;
        context.shadowOffsetY = 3;
        
        // Draw text
        context.fillText(text, canvas.width / 2, canvas.height / 2);
        
        // Create texture from canvas
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        
        // Create material with texture
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            side: THREE.DoubleSide,
            alphaTest: 0.1
        });
        
        // Create a wider plane for the text with better aspect ratio
        const plane = new THREE.Mesh(
            new THREE.PlaneGeometry(8, 2), // Wider geometry
            material
        );
        
        // Set position 
        plane.position.set(0, 0, yOffset);
        plane.scale.set(scale, scale, scale);
        
        return plane;
    }
    
    createCombinedTextMesh(text, color, scale = 1) {
        // Create a canvas to generate texture
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 1024; 
        canvas.height = 512; // Double height for better text formatting
        
        // Clear canvas - no background for simple white text
        context.fillStyle = 'rgba(0, 0, 0, 0)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Set text properties
        context.font = 'bold 64px Arial'; // Increased from 48px to 64px
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillStyle = '#ffffff';
        
        // Add text shadow for better visibility against dark floor
        context.shadowColor = 'rgba(0, 0, 0, 0.9)';
        context.shadowBlur = 5;
        context.shadowOffsetX = 2;
        context.shadowOffsetY = 2;
        
        // Split text into lines and draw each line
        const lines = text.split('\n\n');
        const lineHeight = 100; // Increased from 80 to 100 for more spacing between lines
        
        for (let i = 0; i < lines.length; i++) {
            const y = canvas.height/2 - ((lines.length-1) * lineHeight/2) + (i * lineHeight);
            context.fillText(lines[i], canvas.width/2, y);
        }
        
        // Create texture from canvas
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        
        // Create material with texture
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false // Prevents z-fighting with floor
        });
        
        // Create a wide plane for the text
        const plane = new THREE.Mesh(
            new THREE.PlaneGeometry(8, 4), // Increased height from 3 to 4
            material
        );
        
        // Properly position the plane
        plane.scale.set(scale, scale, scale);
        
        return plane;
    }
    
    update() {
        try {
            // Disabled billboard animation - billboards remain static now
            // if (this.signs) {
            //     this.signs.forEach((billboardGroup, index) => {
            //         // Small wobble effect on the Y-axis
            //         if (billboardGroup.rotation) {
            //             const wobble = Math.sin(this.time.elapsed * 0.001 + index) * 0.01;
            //             billboardGroup.rotation.y += wobble;
            //         }
            //     });
            // }
            
            // Check for and remove any debug lines
            this.removeDebugLines();
        } catch (error) {
            console.error("Error updating track:", error);
        }
    }
    
    // Method to remove any debug lines from the scene
    removeDebugLines() {
        // Find and remove any red line objects
        let removedLines = 0;
        this.scene.traverse((child) => {
            // Specifically target THREE.Line objects
            if (child instanceof THREE.Line || 
                child instanceof THREE.LineSegments || 
                child instanceof THREE.LineLoop) {
                
                // Skip our deliberately created track lines and markers
                if (child === this.centerTube || 
                    child === this.innerTube || 
                    child === this.outerTube ||
                    child.userData.isIntentional || 
                    child.userData.isDash ||
                    child.userData.isMarker ||
                    (this.centerDashes && this.centerDashes.children.includes(child))) {
                    return;
                }
                
                // Specifically target red lines - the most common debug color
                let isRedLine = false;
                
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        // Check all materials for red color
                        isRedLine = child.material.some(mat => 
                            (mat.color && 
                             (mat.color.r > 0.9 && mat.color.g < 0.3 && mat.color.b < 0.3)) || 
                            (mat.color && mat.color.getHex && mat.color.getHex() === 0xff0000)
                        );
                    } else {
                        // Check single material for red color
                        isRedLine = (child.material.color && 
                                     (child.material.color.r > 0.9 && child.material.color.g < 0.3 && child.material.color.b < 0.3)) || 
                                    (child.material.color && child.material.color.getHex && child.material.color.getHex() === 0xff0000);
                    }
                }
                
                // Remove all lines for safety, but log specifically for red lines
                if (child.parent) {
                    child.parent.remove(child);
                    removedLines++;
                    
                    if (isRedLine) {
                        console.log("Removed red debug line from scene");
                    } else {
                        console.log("Removed potential debug line from scene");
                    }
                }
                
                // Dispose of materials
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(material => {
                            if (material && material.dispose) material.dispose();
                        });
                    } else if (child.material.dispose) {
                        child.material.dispose();
                    }
                }
                
                // Dispose of geometry
                if (child.geometry && child.geometry.dispose) {
                    child.geometry.dispose();
                }
            }
        });
        
        if (removedLines > 0) {
            console.log(`Removed ${removedLines} debug lines from scene`);
        }
    }

    // Add convenient methods used by RCCar
    getPointAt(t) {
        try {
            return this.trackCurve.getPointAt(t);
        } catch (error) {
            console.error("Error getting point at:", error);
            return new THREE.Vector3(0, 0, 0);
        }
    }
    
    getTangentAt(t) {
        try {
            return this.trackCurve.getTangentAt(t);
        } catch (error) {
            console.error("Error getting tangent at:", error);
            return new THREE.Vector3(1, 0, 0);
        }
    }

    // Replacement for the old createDottedCenterLine method for backward compatibility
    createDottedCenterLine(radius) {
        return this.createDottedLine(radius, 0.05);
    }

    // New method to create canvas textures for billboards
    createBillboardTexture(title, color, subtitle) {
        console.log(`Creating billboard texture with title: "${title}", color: ${color}, subtitle: ${subtitle}`);
        
        try {
            // Use completely different approach - simpler, more direct
            const size = 512;
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = size;
            canvas.height = size;
            
            // Parse color
            let r = 255, g = 0, b = 0; // Default to red if parsing fails
            try {
                if (color.startsWith('#')) {
                    r = parseInt(color.slice(1, 3), 16);
                    g = parseInt(color.slice(3, 5), 16);
                    b = parseInt(color.slice(5, 7), 16);
                } else if (typeof color === 'number') {
                    const threeColor = new THREE.Color(color);
                    r = Math.floor(threeColor.r * 255);
                    g = Math.floor(threeColor.g * 255);
                    b = Math.floor(threeColor.b * 255);
                }
            } catch (e) {
                console.error("Color parsing error:", e);
            }
            
            console.log(`Using RGB color: ${r}, ${g}, ${b}`);
            
            // Create a simple, high-contrast pattern
            // Main background
            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            ctx.fillRect(0, 0, size, size);
            
            // Add border
            const borderSize = 30;
            ctx.fillStyle = '#FFFFFF'; // White border
            ctx.fillRect(0, 0, size, borderSize);
            ctx.fillRect(0, 0, borderSize, size);
            ctx.fillRect(size - borderSize, 0, borderSize, size);
            ctx.fillRect(0, size - borderSize, size, borderSize);
            
            // Inner rectangle
            ctx.fillStyle = `rgb(${Math.max(0, r-50)}, ${Math.max(0, g-50)}, ${Math.max(0, b-50)})`;
            ctx.fillRect(borderSize * 2, borderSize * 2, 
                        size - borderSize * 4, size - borderSize * 4);
            
            // Add text
            ctx.fillStyle = '#FFFFFF'; // White text
            ctx.font = 'bold 48px Arial, Helvetica, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Draw text or a default pattern if text is empty
            let displayText = (title && title.length > 0) ? 
                              title.substring(0, 15) : 
                              "BILLBOARD " + subtitle;
                              
            ctx.fillText(displayText, size/2, size/2);
            
            // Create texture
            const texture = new THREE.CanvasTexture(canvas);
            texture.needsUpdate = true;
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            
            console.log("Billboard texture created successfully");
            return texture;
        } catch (error) {
            console.error("Failed to create billboard texture:", error);
            
            // Create emergency fallback texture
            const fallbackCanvas = document.createElement('canvas');
            fallbackCanvas.width = 256;
            fallbackCanvas.height = 256;
            const ctx = fallbackCanvas.getContext('2d');
            
            // Red background with text
            ctx.fillStyle = '#FF0000';
            ctx.fillRect(0, 0, 256, 256);
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 36px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('ERROR', 128, 128);
            
            const fallbackTexture = new THREE.CanvasTexture(fallbackCanvas);
            fallbackTexture.needsUpdate = true;
            return fallbackTexture;
        }
    }

    // Helper to draw wrapped text
    drawWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
        const words = text.split(' ');
        let line = '';
        let testLine = '';
        let lineCount = 0;
        
        for (let n = 0; n < words.length; n++) {
            testLine = line + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            const testWidth = metrics.width;
            
            if (testWidth > maxWidth && n > 0) {
                ctx.fillText(line, x, y + (lineCount * lineHeight));
                line = words[n] + ' ';
                lineCount++;
            } else {
                line = testLine;
            }
        }
        
        ctx.fillText(line, x, y + (lineCount * lineHeight));
    }
} 
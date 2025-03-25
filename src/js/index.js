import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { gsap } from 'gsap';

// Experience class
import Experience from './Experience.js';
import DebugLineRemover from './utils/DebugLineRemover.js';

// Add debugging information
console.log("Starting application");
console.log("THREE.js version:", THREE.REVISION);
console.log("User Agent:", navigator.userAgent);

// Function to show error messages
function showError(message) {
    console.error(message);
    
    // Show fallback message
    const fallbackMessage = document.querySelector('.fallback-message');
    if (fallbackMessage) {
        fallbackMessage.style.display = 'block';
    }
}

// Initialize immediately when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded");
    
    // Add error handling for WebGL context
    try {
        // Check WebGL support
        const canvas = document.createElement('canvas');
        let gl;
        
        try {
            gl = canvas.getContext('webgl2') || 
                 canvas.getContext('webgl') || 
                 canvas.getContext('experimental-webgl');
        } catch (e) {
            console.error("Error getting WebGL context:", e);
        }
        
        if (!gl) {
            throw new Error("WebGL not supported by your browser");
        }
        
        console.log("WebGL supported");

        // Create a canvas element for WebGL
        const canvas3D = document.createElement('canvas');
        canvas3D.className = 'webgl-canvas';
        
        // Find the container
        const container = document.querySelector('.webgl-container');
        
        if (!container) {
            console.error("Container not found, creating one");
            // Create container if it doesn't exist
            const newContainer = document.createElement('div');
            newContainer.className = 'webgl-container';
            document.body.appendChild(newContainer);
            newContainer.appendChild(canvas3D);
            // Initialize the experience with the canvas
            console.log("Initializing with new container");
            initExperience(canvas3D);
        } else {
            // Add canvas to existing container
            container.appendChild(canvas3D);
            console.log("Initializing with existing container");
            // Initialize the experience with the canvas
            initExperience(canvas3D);
        }
    } catch (error) {
        showError(`Error: ${error.message}`);
    }
});

// Function to initialize the experience
function initExperience(canvas) {
    try {
        // Ensure debug is disabled
        if (window.location.hash === '#debug') {
            // Remove debug hash to disable debug mode
            history.replaceState(null, document.title, window.location.pathname + window.location.search);
        }
        
        // Patch CatmullRomCurve3 to prevent red line generation
        patchThreeJSForRedLine();
        
        const experience = new Experience(canvas);
        window.experience = experience; // For debugging
        
        // Remove any debug lines
        removeDebugLines(experience.scene);
        
        // Use our dedicated line remover utility for a more thorough cleanup
        const lineRemover = new DebugLineRemover(experience.scene);
        lineRemover.removeRedLines();
        
        // Aggressive removal at various intervals to catch any delayed rendering
        setTimeout(() => lineRemover.removeRedLines(), 100);
        setTimeout(() => lineRemover.removeRedLines(), 500);
        setTimeout(() => lineRemover.removeRedLines(), 1000);
        
        // Set up window error event in case THREE.js fails later
        window.addEventListener('error', (event) => {
            console.error('Global error:', event);
            if (event.message.includes('WebGL') || event.message.includes('THREE')) {
                showError("3D rendering error. Try refreshing or using a different browser.");
            }
        });
    } catch (error) {
        console.error("Failed to initialize Experience:", error);
        showError("Failed to create 3D experience. Please try a different browser.");
    }
}

/**
 * Patch THREE.js classes to prevent red debug lines
 */
function patchThreeJSForRedLine() {
    // Attempt to patch CatmullRomCurve3 to prevent debug visualization
    if (THREE.CatmullRomCurve3) {
        // Store the original prototype
        const originalProto = THREE.CatmullRomCurve3.prototype;
        
        // Check if there's any visualization method we can override
        if (typeof originalProto.createPointsGeometry === 'function') {
            originalProto._originalCreatePointsGeometry = originalProto.createPointsGeometry;
            originalProto.createPointsGeometry = function() {
                console.log("Prevented visualization of curve");
                return new THREE.BufferGeometry();
            };
        }
        
        // Check for three.js r152+ method
        if (typeof originalProto.createLineGeometry === 'function') {
            originalProto._originalCreateLineGeometry = originalProto.createLineGeometry;
            originalProto.createLineGeometry = function() {
                console.log("Prevented visualization of curve line");
                return new THREE.BufferGeometry();
            };
        }
    }
}

// Function to remove any debug lines from the scene
function removeDebugLines(scene) {
    if (!scene) return;
    
    console.log("Searching for debug lines to remove...");
    
    // Keep track of objects to remove
    const objectsToRemove = [];
    
    // Find all line objects
    scene.traverse((child) => {
        if (child instanceof THREE.Line || 
            child instanceof THREE.LineSegments || 
            child instanceof THREE.LineLoop) {
            
            // Check if it has a red material
            if (child.material && child.material.color) {
                const color = child.material.color;
                
                // Check for red color (0xff0000)
                if ((color.r === 1 && color.g === 0 && color.b === 0) || 
                    color.getHex() === 0xff0000) {
                    console.log("Found red line object:", child);
                    objectsToRemove.push(child);
                }
            }
        }
    });
    
    // Remove all identified objects
    objectsToRemove.forEach(obj => {
        scene.remove(obj);
        console.log("Removed debug line object");
    });
} 
import * as THREE from 'three';

/**
 * Utility class to find and remove debug lines (especially red ones)
 * from a THREE.js scene
 */
export default class DebugLineRemover {
    constructor(scene) {
        this.scene = scene;
    }
    
    /**
     * Scan the scene and remove any red line objects
     */
    removeRedLines() {
        if (!this.scene) return;
        
        console.log("Scanning for red line objects to remove...");
        const objectsToRemove = [];
        
        // First pass: identify all line objects in the scene
        this.scene.traverse((object) => {
            // Check for any kind of line object
            if (object instanceof THREE.Line || 
                object instanceof THREE.LineSegments || 
                object instanceof THREE.LineLoop) {
                
                console.log("Found line object:", object);
                
                // Check if it's red
                if (object.material) {
                    // Check if it has a color property
                    if (object.material.color) {
                        const color = object.material.color;
                        
                        // Check if the color is red (0xff0000)
                        if ((color.r === 1 && color.g === 0 && color.b === 0) || 
                            color.getHex() === 0xff0000) {
                            console.log("Found red line object to remove:", object);
                            objectsToRemove.push(object);
                        }
                    }
                    
                    // Check if it has uniform color
                    if (object.material.uniforms && 
                        object.material.uniforms.diffuse) {
                        const color = object.material.uniforms.diffuse.value;
                        if (color.r === 1 && color.g === 0 && color.b === 0) {
                            console.log("Found red line uniform color to remove:", object);
                            objectsToRemove.push(object);
                        }
                    }
                }
                
                // Remove any line that has a position approximately at height 0
                // (the red line seems to be positioned at y=0)
                if (!objectsToRemove.includes(object) && 
                    object.geometry && 
                    object.geometry.boundingSphere) {
                    
                    const center = object.geometry.boundingSphere.center;
                    if (Math.abs(center.y) < 0.1) {
                        console.log("Found line at y=0 to remove:", object);
                        objectsToRemove.push(object);
                    }
                }
            }
        });
        
        // Second pass: remove all identified objects
        objectsToRemove.forEach(object => {
            this.scene.remove(object);
            
            // Also dispose of the geometry and material to fully clean up
            if (object.geometry) {
                object.geometry.dispose();
            }
            
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(material => material.dispose());
                } else {
                    object.material.dispose();
                }
            }
            
            console.log("Successfully removed debug line object");
        });
        
        return objectsToRemove.length;
    }
    
    /**
     * Removes helper lines periodically
     * @param {number} interval - Interval in milliseconds
     */
    startPeriodicRemoval(interval = 1000) {
        // Remove once immediately
        this.removeRedLines();
        
        // Then set an interval to keep checking
        this.removalInterval = setInterval(() => {
            const count = this.removeRedLines();
            
            // If we didn't find any objects for a while, stop checking
            if (count === 0) {
                this.removalCount++;
                if (this.removalCount > 5) {
                    this.stopPeriodicRemoval();
                }
            } else {
                this.removalCount = 0;
            }
        }, interval);
        
        this.removalCount = 0;
    }
    
    /**
     * Stops the periodic removal of red lines
     */
    stopPeriodicRemoval() {
        if (this.removalInterval) {
            clearInterval(this.removalInterval);
            this.removalInterval = null;
            console.log("Stopped periodic removal of debug lines");
        }
    }
} 
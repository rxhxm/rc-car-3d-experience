export default class Debug {
    constructor() {
        this.active = window.location.hash === '#debug';

        if (this.active) {
            console.log('Debug mode is active');
            // We can implement a GUI panel here later if needed
            this.ui = {};
        }
    }
} 
class SpheroOllieController {
    constructor() {
        this.device = null;
        this.server = null;
        this.service = null;
        this.characteristics = {};
        this.isConnected = false;
        
        // Gamepad state
        this.gamepad = null;
        this.gamepadIndex = -1;
        this.lastGamepadState = null;
        this.gamepadPollId = null;
        
        // Movement state
        this.currentSpeed = 128;
        this.isMoving = false;
        
        // Sphero service and characteristic UUIDs
        this.SPHERO_SERVICE_UUID = '22bb746f-2bb0-7554-2d6f-726568705327';
        this.SPHERO_COMMAND_UUID = '22bb746f-2ba1-7554-2d6f-726568705327';
        this.SPHERO_RESPONSE_UUID = '22bb746f-2ba6-7554-2d6f-726568705327';
        
        // Colors from application data
        this.colors = {
            "rood": {r: 255, g: 0, b: 0},
            "blauw": {r: 0, g: 0, b: 255},
            "groen": {r: 0, g: 255, b: 0},
            "geel": {r: 255, g: 255, b: 0},
            "roze": {r: 255, g: 0, b: 255},
            "cyaan": {r: 0, g: 255, b: 255},
            "wit": {r: 255, g: 255, b: 255},
            "uit": {r: 0, g: 0, b: 0}
        };
        
        // Button mapping
        this.buttonMapping = {
            0: 'rood',    // A
            1: 'blauw',   // B  
            2: 'groen',   // X
            3: 'geel'     // Y
        };
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.checkGamepadSupport();
        this.startGamepadPolling();
        this.updateUI();
    }
    
    bindEvents() {
        // Bluetooth controls
        document.getElementById('connect-btn').addEventListener('click', () => this.connectBluetooth());
        document.getElementById('disconnect-btn').addEventListener('click', () => this.disconnectBluetooth());
        
        // Manual color controls
        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {

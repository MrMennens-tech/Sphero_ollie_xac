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
                const color = e.target.dataset.color;
                this.setColor(color);
            });
        });
        
        // Manual movement controls
        document.querySelectorAll('.dpad-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const direction = e.target.dataset.direction;
                this.handleDirectionButton(direction);
            });
        });
        
        // Speed control
        const speedSlider = document.getElementById('speed-slider');
        speedSlider.addEventListener('input', (e) => {
            this.currentSpeed = parseInt(e.target.value);
            document.getElementById('speed-value').textContent = this.currentSpeed;
        });
        
        // Trick buttons
        document.querySelectorAll('.trick-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const trick = e.target.dataset.trick;
                this.performTrick(trick);
            });
        });
        
        // Gamepad connection events
        window.addEventListener('gamepadconnected', (e) => {
            console.log('Gamepad verbonden:', e.gamepad.id);
            this.gamepadIndex = e.gamepad.index;
            this.updateGamepadStatus(true);
        });
        
        window.addEventListener('gamepaddisconnected', (e) => {
            console.log('Gamepad ontkoppeld:', e.gamepad.id);
            this.gamepadIndex = -1;
            this.gamepad = null;
            this.updateGamepadStatus(false);
        });
    }
    
    checkGamepadSupport() {
        if (!navigator.getGamepads) {
            console.warn('Gamepad API wordt niet ondersteund');
            this.updateGamepadStatus(false, 'Niet ondersteund');
            return false;
        }
        
        // Check for existing gamepads
        const gamepads = navigator.getGamepads();
        for (let i = 0; i < gamepads.length; i++) {
            if (gamepads[i]) {
                this.gamepadIndex = i;
                this.updateGamepadStatus(true);
                break;
            }
        }
        return true;
    }
    
    startGamepadPolling() {
        const poll = () => {
            this.pollGamepad();
            this.gamepadPollId = requestAnimationFrame(poll);
        };
        poll();
    }
    
    pollGamepad() {
        if (this.gamepadIndex === -1) return;
        
        const gamepads = navigator.getGamepads();
        const gamepad = gamepads[this.gamepadIndex];
        
        if (!gamepad) {
            this.gamepadIndex = -1;
            this.updateGamepadStatus(false);
            return;
        }
        
        this.gamepad = gamepad;
        this.processGamepadInput(gamepad);
    }
    
    processGamepadInput(gamepad) {
        if (!this.isConnected) return;
        
        // Dead zone threshold
        const DEADZONE = 0.15;
        const TRIGGER_THRESHOLD = 0.5;
        
        // Left stick for movement
        const leftX = Math.abs(gamepad.axes[0]) > DEADZONE ? gamepad.axes[0] : 0;
        const leftY = Math.abs(gamepad.axes[1]) > DEADZONE ? -gamepad.axes[1] : 0; // Invert Y
        
        // Right stick for rotation
        const rightX = Math.abs(gamepad.axes[2]) > DEADZONE ? gamepad.axes[2] : 0;
        
        // Handle movement
        if (leftX !== 0 || leftY !== 0) {
            this.handleStickMovement(leftX, leftY);
        } else if (this.isMoving) {
            this.stopMovement();
        }
        
        // Handle rotation
        if (rightX !== 0) {
            this.handleRotation(rightX);
        }
        
        // Handle face buttons for colors
        for (let i = 0; i < 4; i++) {
            if (gamepad.buttons[i].pressed && (!this.lastGamepadState || !this.lastGamepadState.buttons[i].pressed)) {
                const color = this.buttonMapping[i];
                if (color) {
                    this.setColor(color);
                }
            }
        }
        
        // Handle triggers for tricks
        if (gamepad.buttons[6] && gamepad.buttons[6].value > TRIGGER_THRESHOLD) { // LT
            if (!this.lastGamepadState || this.lastGamepadState.buttons[6].value <= TRIGGER_THRESHOLD) {
                this.performTrick('spin');
            }
        }
        
        if (gamepad.buttons[7] && gamepad.buttons[7].value > TRIGGER_THRESHOLD) { // RT
            if (!this.lastGamepadState || this.lastGamepadState.buttons[7].value <= TRIGGER_THRESHOLD) {
                this.performTrick('shake');
            }
        }
        
        // Handle Xbox button for stop
        if (gamepad.buttons[16] && gamepad.buttons[16].pressed) {
            if (!this.lastGamepadState || !this.lastGamepadState.buttons[16].pressed) {
                this.stopMovement();
                this.setColor('uit');
            }
        }
        
        // D-pad for fine movement
        if (gamepad.buttons[12].pressed) this.roll(0, 50); // Up
        if (gamepad.buttons[13].pressed) this.roll(180, 50); // Down
        if (gamepad.buttons[14].pressed) this.roll(270, 50); // Left
        if (gamepad.buttons[15].pressed) this.roll(90, 50); // Right
        
        // Update feedback
        this.updateGamepadFeedback(gamepad);
        
        // Store current state for next frame
        this.lastGamepadState = {
            buttons: gamepad.buttons.map(btn => ({ pressed: btn.pressed, value: btn.value })),
            axes: [...gamepad.axes]
        };
    }
    
    handleStickMovement(x, y) {
        const magnitude = Math.sqrt(x * x + y * y);
        const angle = Math.atan2(y, x) * (180 / Math.PI);
        const normalizedAngle = (angle + 360) % 360;
        const speed = Math.min(magnitude * 255, 255);
        
        if (speed > 20) { // Minimum threshold
            this.roll(normalizedAngle, speed);
            this.isMoving = true;
        }
    }
    
    handleRotation(x) {
        // Simple rotation - could be expanded for more complex behavior
        const rotationSpeed = Math.abs(x) * 100;
        const direction = x > 0 ? 90 : 270;
        this.roll(direction, rotationSpeed);
    }
    
    handleDirectionButton(direction) {
        const speed = this.currentSpeed;
        
        switch(direction) {
            case 'forward':
                this.roll(0, speed);
                break;
            case 'backward':
                this.roll(180, speed);
                break;
            case 'left':
                this.roll(270, speed);
                break;
            case 'right':
                this.roll(90, speed);
                break;
            case 'stop':
                this.stopMovement();
                break;
        }
    }
    
    async connectBluetooth() {
        try {
            if (!navigator.bluetooth) {
                throw new Error('Web Bluetooth API wordt niet ondersteund in deze browser.');
            }
            
            this.updateConnectionInfo('Zoeken naar Sphero Ollie...');
            
            // Request device
            this.device = await navigator.bluetooth.requestDevice({
                filters: [
                    { namePrefix: 'SK-' }, // Sphero Ollie naming pattern
                    { services: [this.SPHERO_SERVICE_UUID] }
                ],
                optionalServices: [this.SPHERO_SERVICE_UUID]
            });
            
            this.updateConnectionInfo('Verbinden...');
            
            // Connect to GATT server
            this.server = await this.device.gatt.connect();
            
            // Get service
            this.service = await this.server.getPrimaryService(this.SPHERO_SERVICE_UUID);
            
            // Get characteristics
            this.characteristics.command = await this.service.getCharacteristic(this.SPHERO_COMMAND_UUID);
            this.characteristics.response = await this.service.getCharacteristic(this.SPHERO_RESPONSE_UUID);
            
            // Enable notifications
            await this.characteristics.response.startNotifications();
            this.characteristics.response.addEventListener('characteristicvaluechanged', (event) => {
                this.handleResponse(event.target.value);
            });
            
            this.isConnected = true;
            this.updateBluetoothStatus(true);
            this.updateConnectionInfo('Verbonden met ' + this.device.name);
            
            // Wake up the Sphero
            await this.wake();
            
        } catch (error) {
            console.error('Bluetooth verbinding mislukt:', error);
            this.updateConnectionInfo('Verbinding mislukt: ' + error.message);
            this.isConnected = false;
            this.updateBluetoothStatus(false);
        }
    }
    
    async disconnectBluetooth() {
        try {
            if (this.device && this.device.gatt.connected) {
                await this.sleep(); // Put Sphero to sleep
                this.device.gatt.disconnect();
            }
            
            this.device = null;
            this.server = null;
            this.service = null;
            this.characteristics = {};
            this.isConnected = false;
            
            this.updateBluetoothStatus(false);
            this.updateConnectionInfo('Verbinding verbroken');
            
        } catch (error) {
            console.error('Disconnect fout:', error);
        }
    }
    
    async sendCommand(command) {
        if (!this.isConnected || !this.characteristics.command) {
            console.warn('Niet verbonden met Sphero');
            return false;
        }
        
        try {
            await this.characteristics.command.writeValue(command);
            return true;
        } catch (error) {
            console.error('Command verzenden mislukt:', error);
            return false;
        }
    }
    
    async roll(heading, speed) {
        // Create roll command packet
        const command = new Uint8Array([
            0xFF, 0xFE, // Start of packet
            0x02,       // Device ID
            0x30,       // Command ID for roll
            0x05,       // Data length
            heading & 0xFF, (heading >> 8) & 0xFF, // Heading (little endian)
            speed & 0xFF,   // Speed
            0x01,       // State (1 = go)
            0x00        // Checksum placeholder
        ]);
        
        // Calculate checksum
        let checksum = 0;
        for (let i = 2; i < command.length - 1; i++) {
            checksum += command[i];
        }
        command[command.length - 1] = (~checksum) & 0xFF;
        
        await this.sendCommand(command);
    }
    
    async setColor(colorName) {
        const color = this.colors[colorName];
        if (!color) return;
        
        // Create color command packet
        const command = new Uint8Array([
            0xFF, 0xFE, // Start of packet
            0x02,       // Device ID
            0x20,       // Command ID for set RGB LED
            0x04,       // Data length
            color.r,    // Red
            color.g,    // Green
            color.b,    // Blue
            0x00        // Checksum placeholder
        ]);
        
        // Calculate checksum
        let checksum = 0;
        for (let i = 2; i < command.length - 1; i++) {
            checksum += command[i];
        }
        command[command.length - 1] = (~checksum) & 0xFF;
        
        await this.sendCommand(command);
    }
    
    async wake() {
        const command = new Uint8Array([0xFF, 0xFE, 0x00, 0x13, 0x00, 0xED]);
        await this.sendCommand(command);
    }
    
    async sleep() {
        const command = new Uint8Array([0xFF, 0xFE, 0x00, 0x22, 0x00, 0xDE]);
        await this.sendCommand(command);
    }
    
    stopMovement() {
        this.roll(0, 0);
        this.isMoving = false;
    }
    
    async performTrick(trickName) {
        switch(trickName) {
            case 'spin':
                // Perform a 360 degree spin
                await this.roll(0, 200);
                setTimeout(() => this.roll(90, 200), 250);
                setTimeout(() => this.roll(180, 200), 500);
                setTimeout(() => this.roll(270, 200), 750);
                setTimeout(() => this.stopMovement(), 1000);
                break;
            case 'shake':
                // Quick back and forth movement
                await this.roll(0, 150);
                setTimeout(() => this.roll(180, 150), 200);
                setTimeout(() => this.roll(0, 150), 400);
                setTimeout(() => this.stopMovement(), 600);
                break;
        }
    }
    
    handleResponse(value) {
        // Handle responses from Sphero
        console.log('Sphero response:', new Uint8Array(value.buffer));
    }
    
    updateBluetoothStatus(connected) {
        const statusEl = document.getElementById('bluetooth-status');
        const connectBtn = document.getElementById('connect-btn');
        const disconnectBtn = document.getElementById('disconnect-btn');
        
        if (connected) {
            statusEl.textContent = 'Verbonden';
            statusEl.className = 'status--success';
            connectBtn.disabled = true;
            disconnectBtn.disabled = false;
        } else {
            statusEl.textContent = 'Niet verbonden';
            statusEl.className = 'status--error';
            connectBtn.disabled = false;
            disconnectBtn.disabled = true;
        }
    }
    
    updateGamepadStatus(connected, message = '') {
        const statusEl = document.getElementById('gamepad-status');
        
        if (connected) {
            statusEl.textContent = 'Verbonden';
            statusEl.className = 'status--success';
        } else {
            statusEl.textContent = message || 'Niet verbonden';
            statusEl.className = 'status--error';
        }
    }
    
    updateConnectionInfo(message) {
        document.getElementById('connection-info').textContent = message;
    }
    
    updateGamepadFeedback(gamepad) {
        const feedbackEl = document.getElementById('gamepad-feedback');
        const activeInputs = [];
        
        // Check axes
        if (Math.abs(gamepad.axes[0]) > 0.15 || Math.abs(gamepad.axes[1]) > 0.15) {
            activeInputs.push('Linker stick');
        }
        if (Math.abs(gamepad.axes[2]) > 0.15) {
            activeInputs.push('Rechter stick');
        }
        
        // Check buttons
        const buttonNames = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start'];
        gamepad.buttons.forEach((button, index) => {
            if (button.pressed && buttonNames[index]) {
                activeInputs.push(buttonNames[index]);
            }
        });
        
        // Check D-pad
        if (gamepad.buttons[12] && gamepad.buttons[12].pressed) activeInputs.push('D-pad ↑');
        if (gamepad.buttons[13] && gamepad.buttons[13].pressed) activeInputs.push('D-pad ↓');
        if (gamepad.buttons[14] && gamepad.buttons[14].pressed) activeInputs.push('D-pad ←');
        if (gamepad.buttons[15] && gamepad.buttons[15].pressed) activeInputs.push('D-pad →');
        
        if (activeInputs.length > 0) {
            feedbackEl.innerHTML = `<p><strong>Actieve input:</strong> ${activeInputs.join(', ')}</p>`;
        } else {
            feedbackEl.innerHTML = '<p>Wachtend op gamepad input...</p>';
        }
    }
    
    updateUI() {
        this.updateBluetoothStatus(false);
        this.updateGamepadStatus(false);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SpheroOllieController();
});
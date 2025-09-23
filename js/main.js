import { Ollie } from './ollie.js';

// --- DOM Elements ---
const connectButton = document.getElementById('connect-button');
const colorPicker = document.getElementById('color-picker');
const joystickZone = document.getElementById('joystick-zone');
const ollieStatus = document.getElementById('ollie-status');
const ollieStatusDot = document.getElementById('ollie-status-dot');
const gamepadStatus = document.getElementById('gamepad-status');
const gamepadStatusDot = document.getElementById('gamepad-status-dot');
const speedIndicator = document.getElementById('speed-indicator');
const modeIndicator = document.getElementById('mode-indicator');

// --- State Variables ---
const ollie = new Ollie();
let gamepadIndex = null;
let isDriving = false;
let previousButtonStates = [];
let maxSpeed = 1.0; // 100%
let isTrickMode = false;
let currentColor = { r: 0, g: 191, b: 255 }; // Default blue

// --- UI Update Functions ---
function updateOllieStatus(text, statusClass) {
    ollieStatus.textContent = `Ollie: ${text}`;
    ollieStatusDot.className = `status-dot ${statusClass}`;

    // Update connect button text and style based on status
    if (statusClass === 'connected') {
        connectButton.textContent = 'Verbreek Verbinding';
        connectButton.classList.remove('bg-blue-600', 'hover:bg-blue-700');
        connectButton.classList.add('bg-red-600', 'hover:bg-red-700');
    } else {
        connectButton.textContent = 'Verbind met Ollie';
        connectButton.classList.remove('bg-red-600', 'hover:bg-red-700');
        connectButton.classList.add('bg-blue-600', 'hover:bg-blue-700');
    }
}

function updateGamepadStatus(text, statusClass) {
    gamepadStatus.textContent = `Gamepad: ${text}`;
    gamepadStatusDot.className = `status-dot ${statusClass}`;
}

// --- On-screen Joystick Setup ---
const joystickManager = nipplejs.create({
    zone: joystickZone,
    mode: 'static',
    position: { left: '50%', top: '50%' },
    color: 'white',
    size: 150
});

joystickManager.on('move', (evt, data) => {
    if (!ollie.device || gamepadIndex !== null || isTrickMode) return;
    const speed = Math.min(Math.floor(data.distance * 3), 255);
    const heading = Math.round(data.angle.degree);
    // Note the new argument order for drive: heading, then speed
    ollie.drive(heading, Math.round(speed * maxSpeed));
    isDriving = true;
});

joystickManager.on('end', () => {
    if (!ollie.device || !isDriving) return;
    // Stop: drive with current heading but 0 speed
    ollie.drive(ollie.currentHeading, 0);
    isDriving = false;
});

// --- Gamepad API Logic ---
window.addEventListener('gamepadconnected', (e) => {
    console.log('Gamepad connected:', e.gamepad.id);
    gamepadIndex = e.gamepad.index;
    updateGamepadStatus('Verbonden', 'connected');
    previousButtonStates = e.gamepad.buttons.map(b => b.pressed);
    gameLoop();
});

window.addEventListener('gamepaddisconnected', (e) => {
    console.log('Gamepad disconnected:', e.gamepad.id);
    if (gamepadIndex === e.gamepad.index) {
        gamepadIndex = null;
        updateGamepadStatus('Niet verbonden', 'disconnected');
    }
});

function changeMaxSpeed(amount) {
    maxSpeed += amount;
    maxSpeed = Math.max(0.1, Math.min(1.0, maxSpeed)); // Clamp between 10% and 100%
    speedIndicator.textContent = `Max Snelheid: ${Math.round(maxSpeed * 100)}%`;
    // Re-apply color to adjust brightness
    applyColor(currentColor.r, currentColor.g, currentColor.b, true);
}

function applyColor(r, g, b, internalCall = false) {
    if (!ollie.device) return;
    currentColor = {r, g, b};
    const brightR = Math.round(r * maxSpeed);
    const brightG = Math.round(g * maxSpeed);
    const brightB = Math.round(b * maxSpeed);
    // Note the argument order for setColor: r, g, b
    ollie.setColor(brightR, brightG, brightB);

    if (!internalCall) {
        const toHex = c => ('0'+(c).toString(16)).slice(-2);
        colorPicker.value = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }
}

function updateModeIndicator() {
    modeIndicator.textContent = `Modus: ${isTrickMode ? 'Trick' : 'Normaal'}`;
    modeIndicator.className = `w-48 text-center p-2 rounded-lg font-medium ${isTrickMode ? 'bg-purple-600' : 'bg-indigo-600'}`;
}

async function doTrick(trickName) {
    if (!ollie.device) return;
    switch(trickName) {
        case 'spinLeft':
            await ollie.setRawMotors(ollie.Motors.reverse, 200, ollie.Motors.forward, 200);
            setTimeout(() => ollie.setRawMotors(ollie.Motors.off, 0, ollie.Motors.off, 0), 500);
            break;
        case 'spinRight':
            await ollie.setRawMotors(ollie.Motors.forward, 200, ollie.Motors.reverse, 200);
            setTimeout(() => ollie.setRawMotors(ollie.Motors.off, 0, ollie.Motors.off, 0), 500);
            break;
        case 'flipForward':
            await ollie.drive(ollie.currentHeading, 255);
            setTimeout(() => ollie.drive(ollie.currentHeading, 0), 300);
            break;
        case 'flipBackward':
            const backHeading = (ollie.currentHeading + 180) % 360;
            await ollie.drive(backHeading, 255);
            setTimeout(() => ollie.drive(backHeading, 0), 300);
            break;
    }
}

function gameLoop() {
    if (gamepadIndex === null) return;
    
    const gp = navigator.getGamepads()[gamepadIndex];
    if (!gp) return;

    // Create a custom button state array to handle the trigger (button 6 / index 5)
    const TRIGGER_THRESHOLD = 0.5;
    const currentButtonStates = gp.buttons.map((button, index) => {
        // This is X6 (usually button index 5), which is a trigger
        if (index === 5) { 
            return button.value > TRIGGER_THRESHOLD;
        }
        return button.pressed;
    });

    const comboPressed = currentButtonStates[4] && currentButtonStates[5];
    const prevComboPressed = previousButtonStates[4] && previousButtonStates[5];
    if (comboPressed && !prevComboPressed) {
        isTrickMode = !isTrickMode;
        updateModeIndicator();
    }

    if (isTrickMode) {
        if (currentButtonStates[0] && !previousButtonStates[0]) doTrick('spinLeft');
        if (currentButtonStates[1] && !previousButtonStates[1]) doTrick('flipForward');
        if (currentButtonStates[2] && !previousButtonStates[2]) doTrick('flipBackward');
        if (currentButtonStates[3] && !previousButtonStates[3]) doTrick('spinRight');
    } else {
        if (currentButtonStates[4] && !previousButtonStates[4]) changeMaxSpeed(-0.1);
        if (currentButtonStates[5] && !previousButtonStates[5]) changeMaxSpeed(0.1);
        if (currentButtonStates[0] && !previousButtonStates[0]) applyColor(255, 0, 0);
        if (currentButtonStates[1] && !previousButtonStates[1]) applyColor(0, 0, 255);
        if (currentButtonStates[2] && !previousButtonStates[2]) applyColor(0, 255, 0);
        if (currentButtonStates[3] && !previousButtonStates[3]) applyColor(255, 255, 0);

        const x = gp.axes[0];
        const y = -gp.axes[1];
        const deadzone = 0.15;
        const magnitude = Math.sqrt(x * x + y * y);

        if (magnitude > deadzone) {
            isDriving = true;
            const speed = Math.min(Math.floor(((magnitude - deadzone) / (1 - deadzone)) * 255), 255);
            let heading = Math.atan2(x, y) * (180 / Math.PI);
            if (heading < 0) heading += 360;
            
            if (ollie.device) {
                ollie.drive(Math.round(heading), Math.round(speed * maxSpeed));
            }
        } else if (isDriving) {
            if (ollie.device) ollie.drive(ollie.currentHeading, 0);
            isDriving = false;
        }
    }

    previousButtonStates = currentButtonStates;
    requestAnimationFrame(gameLoop);
}

// --- Event Listeners ---
connectButton.addEventListener('click', async () => {
    if (ollie.device && ollie.device.gatt.connected) {
        ollie.disconnect();
    } else {
        try {
            updateOllieStatus('Zoeken...', 'connecting');
            
            // This function will be called by the Ollie class if the connection drops.
            const handleDisconnect = () => {
                updateOllieStatus('Niet verbonden', 'disconnected');
            };

            await ollie.request(handleDisconnect);
            
            console.log('Request returned. Device object:', ollie.device);

            updateOllieStatus('Verbinden...', 'connecting');
            await ollie.connect();
            await ollie.init();
            updateOllieStatus('Verbonden', 'connected');
        } catch (error) {
            console.error('Connection process failed:', error);
            updateOllieStatus('Verbinding mislukt', 'disconnected');
        }
    }
});

colorPicker.addEventListener('input', (event) => {
    const hex = event.target.value;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    applyColor(r, g, b);
});



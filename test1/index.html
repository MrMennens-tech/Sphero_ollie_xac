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
    ollie.drive(Math.round(speed * maxSpeed), heading);
    isDriving = true;
});

joystickManager.on('end', () => {
    if (!ollie.device || !isDriving) return;
    ollie.drive(0, 0); // Stop
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
    ollie.setColor(brightR, brightG, brightB);

    if (!internalCall) {
        // Update color picker UI if changed by gamepad
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
            await ollie.setRawMotors(2, 200, 1, 200);
            setTimeout(() => ollie.setRawMotors(0, 0, 0, 0), 500);
            break;
        case 'spinRight':
            await ollie.setRawMotors(1, 200, 2, 200);
            setTimeout(() => ollie.setRawMotors(0, 0, 0, 0), 500);
            break;
        case 'flipForward':
            await ollie.drive(255, ollie.currentHeading);
            setTimeout(() => ollie.drive(0, ollie.currentHeading), 300);
            break;
        case 'flipBackward':
            const backHeading = (ollie.currentHeading + 180) % 360;
            await ollie.drive(255, backHeading);
            setTimeout(() => ollie.drive(0, backHeading), 300);
            break;
    }
}

function gameLoop() {
    if (gamepadIndex === null) return;
    
    const gp = navigator.getGamepads()[gamepadIndex];
    if (!gp) return;

    const currentButtonStates = gp.buttons.map(b => b.pressed);

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
                ollie.drive(Math.round(speed * maxSpeed), heading);
            }
        } else if (isDriving) {
            if (ollie.device) ollie.drive(0, 0);
            isDriving = false;
        }
    }

    previousButtonStates = currentButtonStates;
    requestAnimationFrame(gameLoop);
}

// --- Event Listeners ---
connectButton.addEventListener('click', async () => {
    if (ollie.device && ollie.device.gatt.connected) {
        ollie.device.gatt.disconnect();
    } else {
        try {
            updateOllieStatus('Zoeken...', 'connecting');
            await ollie.connect();
            updateOllieStatus('Verbonden', 'connected');
            // Re-add event listener after successful connection
            ollie.device.addEventListener('gattserverdisconnected', () => {
                updateOllieStatus('Niet verbonden', 'disconnected');
            });
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

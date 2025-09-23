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
const fullPowerButton = document.getElementById('full-power-button');
const colorInputs = {
    x1: document.getElementById('color-x1'),
    x2: document.getElementById('color-x2'),
    x3: document.getElementById('color-x3'),
    x4: document.getElementById('color-x4'),
};

// --- State Variables ---
const ollie = new Ollie();
let gamepadIndex = null;
let isDriving = false;
let previousButtonStates = [];
let maxSpeed = 0.20; // Start at 20%
const NORMAL_MAX_SPEED = 0.40; // Capped at 40% in normal mode
const SPEED_STEP = 0.05; // Adjust in steps of 5%
let isFullPowerMode = false;
let isTrickMode = false;
let currentColor = { r: 0, g: 191, b: 255 };
let buttonColorMappings = {
    x1: '#ff0000', x2: '#0000ff', x3: '#00ff00', x4: '#ffff00'
};
let isAiming = false;
let aimButtonPressTime = 0;
let lastAimHeading = 0;
const AIM_HOLD_DURATION = 3000;

// --- Helper Functions ---
function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
}

// --- UI Update Functions ---
function updateOllieStatus(text, statusClass) {
    ollieStatus.textContent = `Ollie: ${text}`;
    ollieStatusDot.className = `status-dot ${statusClass}`;
    if (statusClass === 'connected') {
        connectButton.textContent = 'Verbreek Verbinding';
        connectButton.classList.add('bg-red-600', 'hover:bg-red-700');
        connectButton.classList.remove('bg-blue-600', 'hover:bg-blue-700');
    } else {
        connectButton.textContent = 'Verbind met Ollie';
        connectButton.classList.add('bg-blue-600', 'hover:bg-blue-700');
        connectButton.classList.remove('bg-red-600', 'hover:bg-red-700');
    }
}

function updateGamepadStatus(text, statusClass) {
    gamepadStatus.textContent = `Gamepad: ${text}`;
    gamepadStatusDot.className = `status-dot ${statusClass}`;
}

function updateSpeedIndicator() {
    const speedToShow = isFullPowerMode ? 1.0 : maxSpeed;
    speedIndicator.textContent = `Max Snelheid: ${Math.round(speedToShow * 100)}%`;
}

function updateFullPowerButtonUI() {
    fullPowerButton.textContent = `Full Power: ${isFullPowerMode ? 'AAN' : 'UIT'}`;
    fullPowerButton.classList.toggle('bg-green-600', isFullPowerMode);
    fullPowerButton.classList.toggle('hover:bg-green-700', isFullPowerMode);
    fullPowerButton.classList.toggle('bg-gray-600', !isFullPowerMode);
    fullPowerButton.classList.toggle('hover:bg-gray-700', !isFullPowerMode);
    updateSpeedIndicator();
    applyColor(currentColor.r, currentColor.g, currentColor.b, true);
}

// --- On-screen Joystick Setup ---
const joystickManager = nipplejs.create({
    zone: joystickZone, mode: 'static', position: { left: '50%', top: '50%' }, color: 'white', size: 150
});
joystickManager.on('move', (evt, data) => {
    if (!ollie.device || gamepadIndex !== null || isTrickMode) return;
    const speed = Math.min(Math.floor(data.distance * 3), 255);
    const heading = Math.round(data.angle.degree);
    const currentMaxSpeed = isFullPowerMode ? 1.0 : maxSpeed;
    ollie.drive(heading, Math.round(speed * currentMaxSpeed));
    isDriving = true;
});
joystickManager.on('end', () => {
    if (!ollie.device || !isDriving) return;
    ollie.drive(ollie.currentHeading, 0);
    isDriving = false;
});

// --- Gamepad API Logic ---
window.addEventListener('gamepadconnected', (e) => {
    gamepadIndex = e.gamepad.index;
    updateGamepadStatus('Verbonden', 'connected');
    previousButtonStates = e.gamepad.buttons.map(b => ({ pressed: b.pressed, value: b.value }));
    gameLoop();
});
window.addEventListener('gamepaddisconnected', (e) => {
    if (gamepadIndex === e.gamepad.index) {
        gamepadIndex = null;
        updateGamepadStatus('Niet verbonden', 'disconnected');
    }
});

function changeMaxSpeed(amount) {
    if (isFullPowerMode) return;
    maxSpeed += SPEED_STEP * amount;
    maxSpeed = Math.max(0.1, Math.min(NORMAL_MAX_SPEED, maxSpeed));
    updateSpeedIndicator();
    applyColor(currentColor.r, currentColor.g, currentColor.b, true);
}

function applyColor(r, g, b, internalCall = false) {
    if (!ollie.device) return;
    currentColor = { r, g, b };
    const currentMaxSpeed = isFullPowerMode ? 1.0 : maxSpeed;
    const brightR = Math.round(r * currentMaxSpeed);
    const brightG = Math.round(g * currentMaxSpeed);
    const brightB = Math.round(b * currentMaxSpeed);
    ollie.setColor(brightR, brightG, brightB);
    if (!internalCall) {
        const toHex = c => ('0' + (c).toString(16)).slice(-2);
        colorPicker.value = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }
}

function updateModeIndicator() {
    let modeText = 'Normaal', modeClass = 'bg-indigo-600';
    if (isTrickMode) {
        modeText = 'Trick';
        modeClass = 'bg-purple-600';
    } else if (isAiming) {
        modeText = 'Richten...';
        modeClass = 'bg-yellow-600';
    }
    modeIndicator.textContent = `Modus: ${modeText}`;
    modeIndicator.className = `w-48 text-center p-2 rounded-lg font-medium ${modeClass}`;
}

async function doTrick(trickName) {
    if (!ollie.device) return;
    const power = 255;
    const duration = 400;
    switch (trickName) {
        case 'spinLeft':
            await ollie.setRawMotors(ollie.Motors.reverse, power, ollie.Motors.forward, power);
            setTimeout(() => ollie.setRawMotors(ollie.Motors.off, 0, ollie.Motors.off, 0), duration);
            break;
        case 'spinRight':
            await ollie.setRawMotors(ollie.Motors.forward, power, ollie.Motors.reverse, power);
            setTimeout(() => ollie.setRawMotors(ollie.Motors.off, 0, ollie.Motors.off, 0), duration);
            break;
        case 'flipForward': // CORRECTED JUMP
            await ollie.setRawMotors(ollie.Motors.forward, power, ollie.Motors.forward, power);
            setTimeout(() => ollie.setRawMotors(ollie.Motors.off, 0, ollie.Motors.off, 0), duration);
            break;
        case 'flipBackward': // CORRECTED JUMP
            await ollie.setRawMotors(ollie.Motors.reverse, power, ollie.Motors.reverse, power);
            setTimeout(() => ollie.setRawMotors(ollie.Motors.off, 0, ollie.Motors.off, 0), duration);
            break;
    }
}

function handleAiming(gp) {
    const x = gp.axes[0], y = -gp.axes[1], deadzone = 0.2;
    if (Math.sqrt(x * x + y * y) > deadzone) {
        let heading = Math.atan2(x, y) * (180 / Math.PI);
        if (heading < 0) heading += 360;
        lastAimHeading = Math.round(heading);
        const spinSpeed = 80;
        if (x > 0) ollie.setRawMotors(ollie.Motors.forward, spinSpeed, ollie.Motors.reverse, spinSpeed);
        else ollie.setRawMotors(ollie.Motors.reverse, spinSpeed, ollie.Motors.forward, spinSpeed);
    } else {
        ollie.setRawMotors(ollie.Motors.off, 0, ollie.Motors.off, 0);
    }
}

function gameLoop() {
    if (gamepadIndex === null || !ollie.device) return;
    const gp = navigator.getGamepads()[gamepadIndex];
    if (!gp) return;

    const TRIGGER_THRESHOLD = 0.5;
    const currentButtonStates = gp.buttons.map((button, index) => ({
        pressed: (index === 6) ? button.value > TRIGGER_THRESHOLD : button.pressed,
        value: button.value
    }));

    const btn = {
        X1: currentButtonStates[2], X2: currentButtonStates[3], X3: currentButtonStates[0],
        X4: currentButtonStates[1], X5: currentButtonStates[4], X6: currentButtonStates[6]
    };
    const prev_btn_X2 = previousButtonStates[3];

    if (btn.X2.pressed && !prev_btn_X2.pressed) aimButtonPressTime = Date.now();
    if (btn.X2.pressed && !isAiming && Date.now() - aimButtonPressTime > AIM_HOLD_DURATION) {
        isAiming = true;
        ollie.setBackLed(255);
        updateModeIndicator();
    }
    if (!btn.X2.pressed && prev_btn_X2.pressed) {
        if (isAiming) {
            isAiming = false;
            ollie.setHeading(lastAimHeading);
            ollie.setBackLed(0);
            ollie.setRawMotors(ollie.Motors.off, 0, ollie.Motors.off, 0);
            updateModeIndicator();
        } else {
            if (!isTrickMode) {
                const { r, g, b } = hexToRgb(buttonColorMappings.x2); applyColor(r, g, b);
            } else doTrick('flipForward');
        }
        aimButtonPressTime = 0;
    }

    if (isAiming) {
        handleAiming(gp);
    } else {
        const comboPressed = btn.X5.pressed && btn.X6.pressed;
        const prevComboPressed = previousButtonStates[4].pressed && previousButtonStates[6].pressed;
        if (comboPressed && !prevComboPressed) {
            isTrickMode = !isTrickMode;
            isFullPowerMode = isTrickMode; // AUTO FULL POWER
            updateModeIndicator();
            updateFullPowerButtonUI();
        }

        if (isTrickMode) {
            if (btn.X1.pressed && !previousButtonStates[2].pressed) doTrick('spinLeft');
            if (btn.X3.pressed && !previousButtonStates[0].pressed) doTrick('flipBackward');
            if (btn.X4.pressed && !previousButtonStates[1].pressed) doTrick('spinRight');
        } else {
            if (btn.X5.pressed && !previousButtonStates[4].pressed) changeMaxSpeed(-1);
            if (btn.X6.pressed && !previousButtonStates[6].pressed) changeMaxSpeed(1);
            if (btn.X1.pressed && !previousButtonStates[2].pressed) {
                const { r, g, b } = hexToRgb(buttonColorMappings.x1); applyColor(r, g, b);
            }
            if (btn.X3.pressed && !previousButtonStates[0].pressed) {
                const { r, g, b } = hexToRgb(buttonColorMappings.x3); applyColor(r, g, b);
            }
            if (btn.X4.pressed && !previousButtonStates[1].pressed) {
                const { r, g, b } = hexToRgb(buttonColorMappings.x4); applyColor(r, g, b);
            }

            const x = gp.axes[0], y = -gp.axes[1], magnitude = Math.sqrt(x * x + y * y);
            let speed = 0;
            if (magnitude > 0.9) speed = 255;
            else if (magnitude > 0.6) speed = 170;
            else if (magnitude > 0.2) speed = 85;

            if (speed > 0) {
                isDriving = true;
                let heading = Math.atan2(x, y) * (180 / Math.PI);
                if (heading < 0) heading += 360;
                const currentMaxSpeed = isFullPowerMode ? 1.0 : maxSpeed;
                ollie.drive(Math.round(heading), Math.round(speed * currentMaxSpeed));
            } else if (isDriving) {
                ollie.drive(ollie.currentHeading, 0);
                isDriving = false;
            }
        }
    }
    previousButtonStates = currentButtonStates;
    requestAnimationFrame(gameLoop);
}

// --- Event Listeners ---
connectButton.addEventListener('click', async () => {
    if (ollie.device && ollie.device.gatt.connected) {
        try {
            await ollie.sleep();
            setTimeout(() => ollie.disconnect(), 300);
        } catch (error) {
            console.error('Failed to send sleep command, disconnecting anyway.', error);
            ollie.disconnect();
        }
    } else {
        try {
            updateOllieStatus('Zoeken...', 'connecting');
            await ollie.request(() => updateOllieStatus('Niet verbonden', 'disconnected'));
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
    const { r, g, b } = hexToRgb(event.target.value);
    applyColor(r, g, b);
});

fullPowerButton.addEventListener('click', () => {
    isFullPowerMode = !isFullPowerMode;
    updateFullPowerButtonUI();
});

colorInputs.x1.addEventListener('input', (e) => buttonColorMappings.x1 = e.target.value);
colorInputs.x2.addEventListener('input', (e) => buttonColorMappings.x2 = e.target.value);
colorInputs.x3.addEventListener('input', (e) => buttonColorMappings.x3 = e.target.value);
colorInputs.x4.addEventListener('input', (e) => buttonColorMappings.x4 = e.target.value);


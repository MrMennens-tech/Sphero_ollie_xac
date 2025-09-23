import { Ollie } from './ollie.js';

// --- DOM Elements ---
const connectButton = document.getElementById('connect-button');
const joystickZone = document.getElementById('joystick-zone');
const ollieStatus = document.getElementById('ollie-status'), ollieStatusDot = document.getElementById('ollie-status-dot');
const gamepadStatus = document.getElementById('gamepad-status'), gamepadStatusDot = document.getElementById('gamepad-status-dot');
const speedIndicator = document.getElementById('speed-indicator'), modeIndicator = document.getElementById('mode-indicator');
const fullPowerButton = document.getElementById('full-power-button');
const toggleTouchButton = document.getElementById('toggle-touch-button');
const touchControlsPanel = document.getElementById('touch-controls');
const touchTricksPanel = document.getElementById('touch-tricks');
const colorInputs = {
    x1: document.getElementById('color-x1'), x2: document.getElementById('color-x2'),
    x3: document.getElementById('color-x3'), x4: document.getElementById('color-x4'),
};

// --- State Variables ---
const ollie = new Ollie();
let gamepadIndex = null, isDriving = false, previousButtonStates = [];
let maxSpeed = 0.20, NORMAL_MAX_SPEED = 0.40, SPEED_STEP = 0.05;
let isFullPowerMode = false, isTrickMode = false, isAiming = false;
let currentColor = { r: 0, g: 191, b: 255 };
let buttonColorMappings = { x1: '#ff0000', x2: '#0000ff', x3: '#00ff00', x4: '#ffff00' };
let aimButtonPressTime = 0, lastAimHeading = 0;
const AIM_HOLD_DURATION = 3000;

// --- Helper & UI Functions ---
function hexToRgb(hex) {
    return { r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) };
}
function updateUIElement(element, text, className) {
    if (text) element.textContent = text;
    if (className) element.className = className;
}
function updateOllieStatus(text, statusClass) {
    updateUIElement(ollieStatus, `Ollie: ${text}`);
    updateUIElement(ollieStatusDot, null, `status-dot ${statusClass}`);
    if (statusClass === 'connected') {
        updateUIElement(connectButton, 'Verbreek Verbinding', connectButton.className.replace(/blue/g, 'red'));
    } else {
        updateUIElement(connectButton, 'Verbind met Ollie', connectButton.className.replace(/red/g, 'blue'));
    }
}
function updateGamepadStatus(text, statusClass) {
    updateUIElement(gamepadStatus, `Gamepad: ${text}`);
    updateUIElement(gamepadStatusDot, null, `status-dot ${statusClass}`);
}
function updateSpeedIndicator() {
    const speedToShow = isFullPowerMode || isTrickMode ? 1.0 : maxSpeed;
    updateUIElement(speedIndicator, `Max Snelheid: ${Math.round(speedToShow * 100)}%`);
}
function updateFullPowerButtonUI() {
    updateUIElement(fullPowerButton, `Full Power: ${isFullPowerMode ? 'AAN' : 'UIT'}`);
    fullPowerButton.classList.toggle('bg-green-600', isFullPowerMode);
    fullPowerButton.classList.toggle('hover:bg-green-700', isFullPowerMode);
    fullPowerButton.classList.toggle('bg-gray-600', !isFullPowerMode);
    fullPowerButton.classList.toggle('hover:bg-gray-700', !isFullPowerMode);
    updateSpeedIndicator();
    applyColor(currentColor.r, currentColor.g, currentColor.b, true);
}
function updateModeIndicator() {
    let modeText = 'Normaal', modeClass = 'bg-indigo-600';
    if (isTrickMode) { modeText = 'Trick'; modeClass = 'bg-purple-600'; }
    else if (isAiming) { modeText = 'Richten...'; modeClass = 'bg-yellow-600'; }
    updateUIElement(modeIndicator, `Modus: ${modeText}`, `w-48 text-center p-2 rounded-lg font-medium ${modeClass}`);
    touchTricksPanel.classList.toggle('hidden', !isTrickMode);
}

// --- On-screen Joystick ---
const joystickManager = nipplejs.create({ zone: joystickZone, mode: 'static', position: { left: '50%', top: '50%' }, color: 'white', size: 150 });
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

// --- Core Logic Functions ---
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
    const currentMaxSpeed = isFullPowerMode || isTrickMode ? 1.0 : maxSpeed;
    ollie.setColor(Math.round(r * currentMaxSpeed), Math.round(g * currentMaxSpeed), Math.round(b * currentMaxSpeed));
}
async function doTrick(trickName) {
    if (!ollie.device) return;
    const power = 255, duration = 400;
    const M = ollie.Motors;
    switch (trickName) {
        case 'spinLeft': await ollie.setRawMotors(M.reverse, power, M.forward, power); break;
        case 'spinRight': await ollie.setRawMotors(M.forward, power, M.reverse, power); break;
        case 'flipForward': await ollie.setRawMotors(M.forward, power, M.forward, power); break;
        case 'flipBackward': await ollie.setRawMotors(M.reverse, power, M.reverse, power); break;
    }
    setTimeout(() => ollie.setRawMotors(M.off, 0, M.off, 0), duration);
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

// --- Main Gamepad Loop ---
function gameLoop() {
    if (gamepadIndex === null || !ollie.device) return;
    const gp = navigator.getGamepads()[gamepadIndex];
    if (!gp) return;

    const currentButtonStates = gp.buttons.map((b, i) => ({ pressed: (i === 6) ? b.value > 0.5 : b.pressed }));
    const btn = { X1: currentButtonStates[2], X2: currentButtonStates[3], X3: currentButtonStates[0], X4: currentButtonStates[1], X5: currentButtonStates[4], X6: currentButtonStates[6] };
    
    if (btn.X2.pressed && !previousButtonStates[3].pressed) aimButtonPressTime = Date.now();
    if (btn.X2.pressed && !isAiming && Date.now() - aimButtonPressTime > AIM_HOLD_DURATION) {
        isAiming = true;
        ollie.setBackLed(255);
        updateModeIndicator();
    }
    if (!btn.X2.pressed && previousButtonStates[3].pressed) {
        if (isAiming) {
            isAiming = false;
            ollie.setHeading(lastAimHeading);
            ollie.setBackLed(0);
            ollie.setRawMotors(ollie.Motors.off, 0, ollie.Motors.off, 0);
            updateModeIndicator();
        } else {
            if (!isTrickMode) { const { r, g, b } = hexToRgb(buttonColorMappings.x2); applyColor(r, g, b); }
            else doTrick('flipForward');
        }
    }

    if (isAiming) {
        handleAiming(gp);
    } else {
        const comboPressed = btn.X5.pressed && btn.X6.pressed;
        if (comboPressed && !(previousButtonStates[4].pressed && previousButtonStates[6].pressed)) {
            isTrickMode = !isTrickMode;
            updateModeIndicator();
        }
        if (isTrickMode) {
            if (btn.X1.pressed && !previousButtonStates[2].pressed) doTrick('spinLeft');
            if (btn.X3.pressed && !previousButtonStates[0].pressed) doTrick('flipBackward');
            if (btn.X4.pressed && !previousButtonStates[1].pressed) doTrick('spinRight');
        } else {
            if (btn.X5.pressed && !previousButtonStates[4].pressed) changeMaxSpeed(-1);
            if (btn.X6.pressed && !previousButtonStates[6].pressed) changeMaxSpeed(1);
            if (btn.X1.pressed && !previousButtonStates[2].pressed) { const { r, g, b } = hexToRgb(buttonColorMappings.x1); applyColor(r, g, b); }
            if (btn.X3.pressed && !previousButtonStates[0].pressed) { const { r, g, b } = hexToRgb(buttonColorMappings.x3); applyColor(r, g, b); }
            if (btn.X4.pressed && !previousButtonStates[1].pressed) { const { r, g, b } = hexToRgb(buttonColorMappings.x4); applyColor(r, g, b); }

            const x = gp.axes[0], y = -gp.axes[1], magnitude = Math.sqrt(x * x + y * y);
            let speed = 0;
            // INCREASED DEADZONE
            if (magnitude > 0.9) speed = 255;
            else if (magnitude > 0.6) speed = 170;
            else if (magnitude > 0.35) speed = 85;

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
    if (ollie.device?.gatt.connected) {
        try {
            await ollie.setBackLed(0); // Turn off AIM led before sleeping
            await ollie.sleep();
            setTimeout(() => ollie.disconnect(), 300);
        } catch (error) { ollie.disconnect(); }
    } else {
        try {
            updateOllieStatus('Zoeken...', 'connecting');
            await ollie.request(() => updateOllieStatus('Niet verbonden', 'disconnected'));
            updateOllieStatus('Verbinden...', 'connecting');
            await ollie.connect(); await ollie.init();
            updateOllieStatus('Verbonden', 'connected');
        } catch (error) { updateOllieStatus('Verbinding mislukt', 'disconnected'); }
    }
});

toggleTouchButton.addEventListener('click', () => {
    joystickZone.classList.toggle('hidden');
    touchControlsPanel.classList.toggle('hidden');
});

// Touch controls
document.getElementById('touch-speed-down').addEventListener('click', () => changeMaxSpeed(-1));
document.getElementById('touch-speed-up').addEventListener('click', () => changeMaxSpeed(1));
document.getElementById('touch-trick-mode').addEventListener('click', () => {
    isTrickMode = !isTrickMode;
    updateModeIndicator();
});
document.getElementById('touch-spin-left').addEventListener('click', () => doTrick('spinLeft'));
document.getElementById('touch-spin-right').addEventListener('click', () => doTrick('spinRight'));
document.getElementById('touch-flip-fwd').addEventListener('click', () => doTrick('flipForward'));
document.getElementById('touch-flip-bwd').addEventListener('click', () => doTrick('flipBackward'));
// Aim touch logic
const touchAimButton = document.getElementById('touch-aim');
let aimTouchTimeout;
touchAimButton.addEventListener('touchstart', (e) => {
    e.preventDefault();
    aimTouchTimeout = setTimeout(() => {
        isAiming = true;
        ollie.setBackLed(255);
        updateModeIndicator();
    }, AIM_HOLD_DURATION);
});
touchAimButton.addEventListener('touchend', (e) => {
    e.preventDefault();
    clearTimeout(aimTouchTimeout);
    if(isAiming) {
        isAiming = false;
        ollie.setHeading(ollie.currentHeading); // Aim with current direction
        ollie.setBackLed(0);
        updateModeIndicator();
    }
});


fullPowerButton.addEventListener('click', () => {
    isFullPowerMode = !isFullPowerMode;
    updateFullPowerButtonUI();
});

window.addEventListener('gamepadconnected', (e) => { gamepadIndex = e.gamepad.index; updateGamepadStatus('Verbonden', 'connected'); previousButtonStates = e.gamepad.buttons.map(b => ({ pressed: b.pressed })); gameLoop(); });
window.addEventListener('gamepaddisconnected', (e) => { if (gamepadIndex === e.gamepad.index) { gamepadIndex = null; updateGamepadStatus('Niet verbonden', 'disconnected'); }});
Object.keys(colorInputs).forEach(key => colorInputs[key].addEventListener('input', (e) => buttonColorMappings[key] = e.target.value));


import { Ollie } from './ollie.js';

// --- DOM Elements ---
const connectButton = document.getElementById('connect-button');
const joystickZone = document.getElementById('joystick-zone');
const ollieStatus = document.getElementById('ollie-status'), ollieStatusDot = document.getElementById('ollie-status-dot');
const gamepadStatus = document.getElementById('gamepad-status'), gamepadStatusDot = document.getElementById('gamepad-status-dot');
const speedIndicator = document.getElementById('speed-indicator'), modeIndicator = document.getElementById('mode-indicator');
const toggleTouchButton = document.getElementById('toggle-touch-button');
const touchControlsPanel = document.getElementById('touch-controls'), touchTricksPanel = document.getElementById('touch-tricks');
const openConfigButton = document.getElementById('open-config-button'), configModal = document.getElementById('config-modal'), closeConfigButton = document.getElementById('close-config-button');
const configInstructions = document.getElementById('config-instructions');
const deadzoneSlider = document.getElementById('deadzone-slider');
const colorInputs = { x1: document.getElementById('color-x1'), x2: document.getElementById('color-x2'), x3: document.getElementById('color-x3'), x4: document.getElementById('color-x4') };
const ollieBatteryText = document.getElementById('ollie-battery'), batteryLevelBar = document.getElementById('battery-level');


// --- State Variables ---
const ollie = new Ollie();
let gamepadIndex = null, isDriving = false, previousButtonStates = [];
let maxSpeed = 0.20, NORMAL_MAX_SPEED = 0.40, EXPERT_MAX_SPEED = 0.60, SPEED_STEP = 0.05;
let currentMode = 'normal'; // 'normal', 'expert', 'trick'
let isAiming = false, aimButtonPressTime = 0, lastAimHeading = 0;
let currentColor = { r: 0, g: 191, b: 255 };
let buttonColorMappings = { x1: '#ff0000', x2: '#0000ff', x3: '#00ff00', x4: '#ffff00' };
const AIM_HOLD_DURATION = 3000;
let joystickDeadzone = 0.4;
let stopCommandInterval = null;
let batteryInterval = null;
let trickModeLEDInterval = null;

// --- Controller Configuration ---
// MODIFIED: Swapped default buttons for speed up/down
let buttonMappings = { SPEED_DOWN: 6, SPEED_UP: 4, COLOR_X1: 2, COLOR_X2_AIM: 3, COLOR_X3: 0, COLOR_X4: 1, CYCLE_MODE: 10 };
let isWaitingForInput = false;
let actionToMap = '';

// --- Helper & UI Functions ---
const hexToRgb = (hex) => ({ r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) });
const updateUI = (el, text, className) => { if(text) el.textContent = text; if(className) el.className = className; };
function updateOllieStatus(text, statusClass) {
    updateUI(ollieStatus, `Ollie: ${text}`);
    updateUI(ollieStatusDot, null, `status-dot ${statusClass}`);
    updateUI(connectButton, statusClass === 'connected' ? 'Verbreek Verbinding' : 'Verbind met Ollie', statusClass === 'connected' ? 'btn btn-red' : 'btn btn-blue');
}
const updateGamepadStatus = (text, statusClass) => { updateUI(gamepadStatus, `Gamepad: ${text}`); updateUI(gamepadStatusDot, null, `status-dot ${statusClass}`); };
function updateSpeedIndicator() {
    let speedCap = (currentMode === 'expert') ? EXPERT_MAX_SPEED : NORMAL_MAX_SPEED;
    if (currentMode === 'trick') speedCap = 1.0;
    updateUI(speedIndicator, `Max Snelheid: ${Math.round(Math.min(maxSpeed, speedCap) * 100)}%`);
}
function updateModeIndicator() {
    const modes = { normal: ['Normaal', 'bg-indigo-600'], expert: ['Expert', 'bg-green-600'], trick: ['Trick', 'bg-purple-600'], aiming: ['Richten...', 'bg-yellow-600'] };
    const [text, className] = modes[isAiming ? 'aiming' : currentMode];
    updateUI(modeIndicator, `Modus: ${text}`, `info-pill ${className}`);
    touchTricksPanel.classList.toggle('hidden', currentMode !== 'trick');
}
function updateBatteryUI(level) {
    if (level === null) {
        ollieBatteryText.textContent = 'Batterij: N/A';
        batteryLevelBar.style.width = '100%';
        batteryLevelBar.style.backgroundColor = '#6b7280'; // gray-500
        return;
    }
    ollieBatteryText.textContent = `Batterij: ${level}%`;
    batteryLevelBar.style.width = `${level}%`;
    if (level > 50) batteryLevelBar.style.backgroundColor = '#4ade80'; // green-400
    else if (level > 20) batteryLevelBar.style.backgroundColor = '#facc15'; // yellow-400
    else batteryLevelBar.style.backgroundColor = '#f87171'; // red-400
}

// --- On-screen Joystick ---
const joystickManager = nipplejs.create({ zone: joystickZone, mode: 'static', position: { left: '50%', top: '50%' }, color: 'white', size: 150 });
joystickManager.on('move', (evt, data) => {
    if (!ollie.device || gamepadIndex !== null || currentMode === 'trick') return;
    const speed = Math.min(Math.floor(data.distance * 3), 255);
    const heading = Math.round(data.angle.degree);
    let speedCap = (currentMode === 'expert') ? EXPERT_MAX_SPEED : NORMAL_MAX_SPEED;
    ollie.drive(heading, Math.round(speed * Math.min(maxSpeed, speedCap)));
    isDriving = true;
});
joystickManager.on('end', () => { if (isDriving) { ollie.drive(0, 0); isDriving = false; } });

// --- Core Logic ---
function changeMaxSpeed(amount) { maxSpeed = Math.max(0.1, maxSpeed + SPEED_STEP * amount); updateSpeedIndicator(); applyColor(currentColor.r, currentColor.g, currentColor.b, true); };
function applyColor(r, g, b, internalCall = false) {
    if (!ollie.device) return;
    currentColor = { r, g, b };
    let speedCap = (currentMode === 'expert') ? EXPERT_MAX_SPEED : NORMAL_MAX_SPEED;
    
    // Brightness reaches 100% when speed is at 50% of the cap.
    const brightnessMultiplier = Math.min(1.0, (maxSpeed / speedCap) / 0.5);

    ollie.setColor(
        Math.round(r * brightnessMultiplier), 
        Math.round(g * brightnessMultiplier), 
        Math.round(b * brightnessMultiplier)
    );
}
async function doTrick(trickName) {
    if (!ollie.device) return;
    const p = 255, M = ollie.Motors;
    const duration = trickName.includes('spin') ? 800 : 400;
    const actions = { spinLeft: [M.reverse, p, M.forward, p], spinRight: [M.forward, p, M.reverse, p], flipForward: [M.forward, p, M.forward, p], flipBackward: [M.reverse, p, M.reverse, p] };
    await ollie.setRawMotors(...actions[trickName]);
    setTimeout(() => ollie.setRawMotors(M.off, 0, M.off, 0), duration);
}
const handleAiming = (gp) => {
    const x = gp.axes[0], y = -gp.axes[1];
    if (Math.sqrt(x * x + y * y) > 0.2) {
        lastAimHeading = Math.round((Math.atan2(x, y) * (180 / Math.PI) + 360) % 360);
        ollie.setRawMotors(ollie.Motors.forward, 80, ollie.Motors.reverse, 80);
    } else { ollie.setRawMotors(ollie.Motors.off, 0, ollie.Motors.off, 0); }
};
function cycleMode() {
    const modes = ['normal', 'expert', 'trick'];
    const oldMode = currentMode;
    currentMode = modes[(modes.indexOf(currentMode) + 1) % modes.length];

    if (currentMode === 'trick') {
        if (trickModeLEDInterval) clearInterval(trickModeLEDInterval);
        let isPurple = false;
        trickModeLEDInterval = setInterval(() => {
            if (!ollie.device?.gatt.connected) { clearInterval(trickModeLEDInterval); trickModeLEDInterval = null; return; }
            if (isPurple) { applyColor(currentColor.r, currentColor.g, currentColor.b, true); } 
            else { ollie.setColor(128, 0, 128); }
            isPurple = !isPurple;
        }, 500);
    } else {
        if (trickModeLEDInterval) { clearInterval(trickModeLEDInterval); trickModeLEDInterval = null; }
        applyColor(currentColor.r, currentColor.g, currentColor.b, true); 
    }

    if (oldMode === 'trick' && ollie.device) { ollie.setHeading(0); console.log("Exited trick mode, recalibrating heading."); }
    updateModeIndicator();
    updateSpeedIndicator();
}


// --- Main Gamepad Loop ---
function gameLoop() {
    if (!gamepadIndex && gamepadIndex !== 0) return requestAnimationFrame(gameLoop);
    const gp = navigator.getGamepads()[gamepadIndex];
    if (!gp) return requestAnimationFrame(gameLoop);

    if (isWaitingForInput) {
        const pressedButton = gp.buttons.findIndex(b => b.pressed || b.value > 0.5);
        if (pressedButton > -1) {
            console.log(`[Config] Detected button press! Index: ${pressedButton}, Value: ${gp.buttons[pressedButton].value.toFixed(2)}`);
            buttonMappings[actionToMap] = pressedButton;
            document.getElementById(`map-${actionToMap}`).textContent = `B${pressedButton}`;
            isWaitingForInput = false;
            configInstructions.textContent = 'Gekoppeld! Kies een andere actie.';
        }
        return requestAnimationFrame(gameLoop);
    }

    const getBtn = (action) => gp.buttons[buttonMappings[action]];
    const btnState = (action) => {
        const btn = getBtn(action);
        // MODIFIED: Check for trigger on SPEED_DOWN
        return btn ? (action === 'SPEED_DOWN' ? btn.value > 0.5 : btn.pressed) : false;
    };
    const btnPressed = (action) => btnState(action) && !previousButtonStates[buttonMappings[action]];

    if (btnPressed('CYCLE_MODE')) cycleMode();

    if (isAiming) {
        handleAiming(gp);
        if (!btnState('COLOR_X2_AIM')) {
            isAiming = false;
            ollie.setHeading(lastAimHeading);
            ollie.setBackLed(0);
            ollie.setRawMotors(ollie.Motors.off, 0, ollie.Motors.off, 0);
            updateModeIndicator();
        }
    } else if (currentMode === 'trick') {
        if (btnPressed('COLOR_X1')) doTrick('spinLeft');
        if (btnPressed('COLOR_X3')) doTrick('flipBackward');
        if (btnPressed('COLOR_X4')) doTrick('spinRight');
        if (btnPressed('COLOR_X2_AIM')) doTrick('flipForward');
    } else { // Normal or Expert
        if (btnState('COLOR_X2_AIM') && !previousButtonStates[buttonMappings['COLOR_X2_AIM']]) aimButtonPressTime = Date.now();
        if (btnState('COLOR_X2_AIM') && Date.now() - aimButtonPressTime > AIM_HOLD_DURATION) { isAiming = true; ollie.setBackLed(255); updateModeIndicator(); }
        if (!btnState('COLOR_X2_AIM') && previousButtonStates[buttonMappings['COLOR_X2_AIM']]) { if (Date.now() - aimButtonPressTime < AIM_HOLD_DURATION) { const { r, g, b } = hexToRgb(buttonColorMappings.x2); applyColor(r, g, b); } }

        if (btnPressed('SPEED_DOWN')) changeMaxSpeed(-1);
        if (btnPressed('SPEED_UP')) changeMaxSpeed(1);
        if (btnPressed('COLOR_X1')) { const { r, g, b } = hexToRgb(buttonColorMappings.x1); applyColor(r, g, b); }
        if (btnPressed('COLOR_X3')) { const { r, g, b } = hexToRgb(buttonColorMappings.x3); applyColor(r, g, b); }
        if (btnPressed('COLOR_X4')) { const { r, g, b } = hexToRgb(buttonColorMappings.x4); applyColor(r, g, b); }

        const x = gp.axes[0], y = -gp.axes[1], magnitude = Math.sqrt(x * x + y * y);
        if (magnitude > joystickDeadzone) {
            isDriving = true;
            if(stopCommandInterval) { clearInterval(stopCommandInterval); stopCommandInterval = null; }
            let speed = (magnitude > 0.9) ? 255 : (magnitude > 0.65) ? 170 : 85;
            const heading = Math.round((Math.atan2(x, y) * (180 / Math.PI) + 360) % 360);
            let speedCap = (currentMode === 'expert') ? EXPERT_MAX_SPEED : NORMAL_MAX_SPEED;
            ollie.drive(heading, Math.round(speed * Math.min(maxSpeed, speedCap)));
        } else if (isDriving) {
            isDriving = false;
            if (!stopCommandInterval) { ollie.drive(0, 0); stopCommandInterval = setInterval(() => ollie.drive(0, 0), 100); }
        }
    }
    previousButtonStates = gp.buttons.map(b => b.pressed || b.value > 0.5);
    requestAnimationFrame(gameLoop);
}

// --- Event Listeners ---
connectButton.addEventListener('click', async () => {
    if (ollie.device?.gatt.connected) {
        if (batteryInterval) { clearInterval(batteryInterval); batteryInterval = null; }
        if (trickModeLEDInterval) { clearInterval(trickModeLEDInterval); trickModeLEDInterval = null; }
        try { await ollie.setBackLed(0); await ollie.sleep(); setTimeout(() => ollie.disconnect(), 300); } catch (e) { ollie.disconnect(); }
    } else {
        try {
            updateOllieStatus('Zoeken...', 'connecting');
            const onDisconnect = () => {
                updateOllieStatus('Niet verbonden', 'disconnected');
                if (batteryInterval) { clearInterval(batteryInterval); batteryInterval = null; }
                if (trickModeLEDInterval) { clearInterval(trickModeLEDInterval); trickModeLEDInterval = null; }
                updateBatteryUI(null);
            };
            await ollie.request(onDisconnect);
            updateOllieStatus('Verbinden...', 'connecting');
            await ollie.connect();
            await ollie.init();
            updateOllieStatus('Verbonden', 'connected');
            if (batteryInterval) clearInterval(batteryInterval);
            batteryInterval = setInterval(async () => {
                try { updateBatteryUI(await ollie.getBatteryLevel()); } 
                catch (error) { updateBatteryUI(null); clearInterval(batteryInterval); }
            }, 30000);
            try { updateBatteryUI(await ollie.getBatteryLevel()); } catch(e){ updateBatteryUI(null); }
        } catch (e) { updateOllieStatus('Verbinding mislukt', 'disconnected'); }
    }
});
toggleTouchButton.addEventListener('click', (e) => {
    const isJoystickVisible = !joystickZone.classList.contains('hidden');
    joystickZone.classList.toggle('hidden', isJoystickVisible);
    touchControlsPanel.classList.toggle('hidden', !isJoystickVisible);
    e.target.textContent = isJoystickVisible ? 'Activeer Touch Modus' : 'Deactiveer Touch Modus';
});
touchControlsPanel.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const action = e.target.dataset.action;
    const trick = e.target.dataset.trick;
    if (action === 'speed-down') changeMaxSpeed(-1);
    else if (action === 'speed-up') changeMaxSpeed(1);
    else if (action === 'cycle-mode') cycleMode();
    else if (trick) doTrick(trick);
});
let aimTouchTimeout;
document.getElementById('touch-aim').addEventListener('touchstart', (e) => { e.preventDefault(); aimTouchTimeout = setTimeout(() => { isAiming = true; ollie.setBackLed(255); updateModeIndicator(); }, AIM_HOLD_DURATION); });
document.getElementById('touch-aim').addEventListener('touchend', (e) => { e.preventDefault(); clearTimeout(aimTouchTimeout); if(isAiming) { isAiming = false; ollie.setHeading(ollie.currentHeading); ollie.setBackLed(0); updateModeIndicator(); } });

openConfigButton.addEventListener('click', () => configModal.classList.remove('hidden'));
closeConfigButton.addEventListener('click', () => { configModal.classList.add('hidden'); isWaitingForInput = false; configInstructions.textContent = 'Druk op een knop om te koppelen...'; });
document.querySelectorAll('.btn-config').forEach(btn => btn.addEventListener('click', (e) => {
    actionToMap = e.target.dataset.action;
    isWaitingForInput = true;
    const logMessage = `[Config] Wacht op invoer voor ${actionToMap}...`;
    configInstructions.textContent = logMessage;
    console.log(logMessage);
}));
deadzoneSlider.addEventListener('input', (e) => joystickDeadzone = parseFloat(e.target.value));
Object.keys(colorInputs).forEach(key => colorInputs[key].addEventListener('input', (e) => buttonColorMappings[key] = e.target.value));

window.addEventListener('gamepadconnected', (e) => { gamepadIndex = e.gamepad.index; updateGamepadStatus('Verbonden', 'connected'); previousButtonStates = e.gamepad.buttons.map(b => false); gameLoop(); });
window.addEventListener('gamepaddisconnected', (e) => { if (gamepadIndex === e.gamepad.index) { gamepadIndex = null; updateGamepadStatus('Niet verbonden', 'disconnected'); }});


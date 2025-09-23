import { Ollie } from './ollie.js';

// --- DOM Elements ---
const connectButton = document.getElementById('connect-button');
const ollieStatus = document.getElementById('ollie-status'), ollieStatusDot = document.getElementById('ollie-status-dot');
const gamepadStatus = document.getElementById('gamepad-status'), gamepadStatusDot = document.getElementById('gamepad-status-dot');
const speedIndicator = document.getElementById('speed-indicator'), modeIndicator = document.getElementById('mode-indicator');
const toggleTouchCheckbox = document.getElementById('toggle-touch-checkbox');
const touchControlsPanel = document.getElementById('touch-controls'), touchTricksPanel = document.getElementById('touch-tricks');
const openConfigButton = document.getElementById('open-config-button'), configModal = document.getElementById('config-modal'), closeConfigButton = document.getElementById('close-config-button');
const configInstructions = document.getElementById('config-instructions');
const deadzoneSlider = document.getElementById('deadzone-slider');
const colorInputs = { x1: document.getElementById('color-x1'), x2: document.getElementById('color-x2'), x3: document.getElementById('color-x3'), x4: document.getElementById('color-x4') };
const emergencyStopButton = document.getElementById('emergency-stop-button');

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
let trickModeLEDInterval = null;

// --- Controller Configuration ---
let buttonMappings = { SPEED_UP: 4, SPEED_DOWN: 6, COLOR_X1: 2, COLOR_X2_AIM: 3, COLOR_X3: 0, COLOR_X4: 1, CYCLE_MODE: 10 };
let isWaitingForInput = false;
let actionToMap = '';

// --- Helper & UI Functions ---
const hexToRgb = (hex) => ({ r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) });
const updateUI = (el, text, className) => { if(el) { if(text !== null) el.textContent = text; if(className) el.className = className; } };

function updateOllieStatus(text, statusClass) {
    updateUI(ollieStatus, `Ollie: ${text}`);
    updateUI(ollieStatusDot, null, `status-dot ${statusClass}`);
    if (statusClass === 'connected') {
        connectButton.textContent = 'Verbreek Verbinding';
        connectButton.className = 'w-full text-center p-3 rounded-lg font-bold text-2xl py-4 transition-all transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 shadow-lg bg-red-600 hover:bg-red-700 text-white';
    } else {
        connectButton.textContent = 'Verbind met Ollie';
        connectButton.className = 'w-full text-center p-3 rounded-lg font-bold text-2xl py-4 transition-all transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 shadow-lg bg-teal-500 hover:bg-teal-600 text-slate-900';
    }
    emergencyStopButton.classList.toggle('hidden', statusClass !== 'connected');
}
const updateGamepadStatus = (text, statusClass) => { updateUI(gamepadStatus, `Gamepad: ${text}`); updateUI(gamepadStatusDot, null, `status-dot ${statusClass}`); };
function updateSpeedIndicator() {
    let speedCap = (currentMode === 'expert') ? EXPERT_MAX_SPEED : NORMAL_MAX_SPEED;
    if (currentMode === 'trick') speedCap = 1.0;
    updateUI(speedIndicator, `Max Snelheid: ${Math.round(Math.min(maxSpeed, speedCap) * 100)}%`);
}
function updateModeIndicator() {
    const modes = { normal: ['Normaal', 'bg-slate-800'], expert: ['Expert', 'bg-green-700'], trick: ['Trick', 'bg-purple-700'], aiming: ['Richten...', 'bg-yellow-600'] };
    const [text, className] = modes[isAiming ? 'aiming' : currentMode];
    updateUI(modeIndicator, `Modus: ${text}`, `w-full text-center p-3 rounded-lg font-medium text-lg shadow-lg ${className}`);
    touchTricksPanel.classList.toggle('hidden', currentMode !== 'trick');
}

// --- Core Logic ---
function changeMaxSpeed(amount) { maxSpeed = Math.max(0.1, maxSpeed + SPEED_STEP * amount); updateSpeedIndicator(); applyColor(currentColor.r, currentColor.g, currentColor.b, true); };
function applyColor(r, g, b, internalCall = false) {
    if (!ollie.device) return;
    currentColor = { r, g, b };
    let speedCap = (currentMode === 'expert') ? EXPERT_MAX_SPEED : NORMAL_MAX_SPEED;
    const brightnessMultiplier = Math.min(1.0, maxSpeed / speedCap);
    ollie.setColor(Math.round(r * brightnessMultiplier), Math.round(g * brightnessMultiplier), Math.round(b * brightnessMultiplier));
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
    // Stop the loop if the gamepad or Ollie is disconnected
    if (gamepadIndex === null || !ollie.device || !ollie.device.gatt.connected) {
        if(stopCommandInterval) clearInterval(stopCommandInterval);
        stopCommandInterval = null;
        return; // Exit the loop completely
    }
    
    const gp = navigator.getGamepads()[gamepadIndex];
    if (!gp) {
        requestAnimationFrame(gameLoop); // Keep trying to find the gamepad
        return;
    }
    
    // --- DEBUGGING ---
    const buttonValues = gp.buttons.map((b, i) => `B${i}:${b.value.toFixed(2)}`).join(' | ');
    // console.log(`[Debug] Buttons: ${buttonValues}`);
    // --- END DEBUGGING ---

    if (isWaitingForInput) {
        const newPressIndex = gp.buttons.findIndex((b, i) => (b.pressed || b.value > 0.5) && !previousButtonStates[i]);
        if (newPressIndex > -1) {
            console.log(`[Config Debug] NEW Button press detected on index: ${newPressIndex} for action: ${actionToMap}`);
            buttonMappings[actionToMap] = newPressIndex;
            document.getElementById(`map-${actionToMap}`).textContent = `${actionToMap.replace(/_/g, ' ')} (B${newPressIndex})`;
            isWaitingForInput = false;
            configInstructions.textContent = 'Gekoppeld! Kies een andere actie.';
        }
    } else {
        const getBtn = (action) => gp.buttons[buttonMappings[action]];
        const btnState = (action) => {
            const btn = getBtn(action);
            if (!btn) return false;
            if (action === 'SPEED_DOWN' || action === 'SPEED_UP') { return btn.value > 0.5; }
            return btn.pressed;
        };
        const btnPressed = (action) => btnState(action) && !previousButtonStates[buttonMappings[action]];

        // Combo for Trick Mode
        const speedUpPressed = btnState('SPEED_UP');
        const speedDownPressed = btnState('SPEED_DOWN');
        const prevSpeedUpPressed = previousButtonStates[buttonMappings['SPEED_UP']];
        const prevSpeedDownPressed = previousButtonStates[buttonMappings['SPEED_DOWN']];
        if ((speedUpPressed && speedDownPressed) && !(prevSpeedUpPressed && prevSpeedDownPressed)) {
            cycleMode();
        }
        
        if (btnPressed('CYCLE_MODE')) cycleMode();

        if (currentMode === 'trick') {
            if (btnPressed('COLOR_X1')) doTrick('spinLeft');
            if (btnPressed('COLOR_X3')) doTrick('flipBackward');
            if (btnPressed('COLOR_X4')) doTrick('spinRight');
            if (btnPressed('COLOR_X2_AIM')) doTrick('flipForward');
        } else if (isAiming) {
            handleAiming(gp);
            if (!btnState('COLOR_X2_AIM')) {
                isAiming = false;
                ollie.setHeading(lastAimHeading);
                ollie.setBackLed(0);
                ollie.setRawMotors(ollie.Motors.off, 0, ollie.Motors.off, 0);
                updateModeIndicator();
            }
        } else {
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
    }
    
    // Update previous states for all buttons
    previousButtonStates = gp.buttons.map(b => b.pressed || b.value > 0.5);
    requestAnimationFrame(gameLoop);
}

// --- Event Listeners ---
connectButton.addEventListener('click', async () => {
    if (ollie.device?.gatt.connected) {
        if (trickModeLEDInterval) clearInterval(trickModeLEDInterval);
        try { 
            await ollie.sleep(); 
            setTimeout(() => ollie.disconnect(), 300); 
        } catch (e) { ollie.disconnect(); }
    } else {
        try {
            updateOllieStatus('Zoeken...', 'connecting');
            const onDisconnect = () => {
                updateOllieStatus('Niet verbonden', 'disconnected');
                if (trickModeLEDInterval) clearInterval(trickModeLEDInterval);
            };
            await ollie.request(onDisconnect);
            updateOllieStatus('Verbinden...', 'connecting');
            await ollie.connect();
            await ollie.init();
            updateOllieStatus('Verbonden', 'connected');
        } catch (e) { updateOllieStatus('Verbinding mislukt', 'disconnected'); }
    }
});

toggleTouchCheckbox.addEventListener('change', (e) => {
    const isTouchActive = e.target.checked;
    touchControlsPanel.classList.toggle('hidden', !isTouchActive);
});

document.querySelector('[data-action="speed-up"]').addEventListener('touchstart', (e) => { e.preventDefault(); changeMaxSpeed(1); });
document.querySelector('[data-action="speed-down"]').addEventListener('touchstart', (e) => { e.preventDefault(); changeMaxSpeed(-1); });
document.querySelector('[data-action="cycle-mode"]').addEventListener('touchstart', (e) => { e.preventDefault(); cycleMode(); });
document.querySelector('[data-trick="spinLeft"]').addEventListener('touchstart', (e) => { e.preventDefault(); doTrick('spinLeft'); });
document.querySelector('[data-trick="spinRight"]').addEventListener('touchstart', (e) => { e.preventDefault(); doTrick('spinRight'); });
document.querySelector('[data-trick="flipForward"]').addEventListener('touchstart', (e) => { e.preventDefault(); doTrick('flipForward'); });
document.querySelector('[data-trick="flipBackward"]').addEventListener('touchstart', (e) => { e.preventDefault(); doTrick('flipBackward'); });

emergencyStopButton.addEventListener('click', () => { if(ollie.device?.gatt.connected) { console.log("EMERGENCY STOP"); ollie.stop(); }});
let aimTouchTimeout;
document.getElementById('touch-aim').addEventListener('touchstart', (e) => { e.preventDefault(); aimButtonPressTime = Date.now(); aimTouchTimeout = setTimeout(() => { isAiming = true; ollie.setBackLed(255); updateModeIndicator(); }, AIM_HOLD_DURATION); });
document.getElementById('touch-aim').addEventListener('touchend', (e) => { e.preventDefault(); clearTimeout(aimTouchTimeout); if(isAiming) { isAiming = false; ollie.setHeading(ollie.currentHeading); ollie.setBackLed(0); updateModeIndicator(); } });

openConfigButton.addEventListener('click', () => configModal.classList.remove('hidden'));
closeConfigButton.addEventListener('click', () => { configModal.classList.add('hidden'); isWaitingForInput = false; configInstructions.textContent = 'Kies een actie en druk de gewenste knop in je controller.'; });
document.querySelectorAll('.btn-config').forEach(btn => btn.addEventListener('click', (e) => {
    actionToMap = e.target.dataset.action;
    isWaitingForInput = true;
    const logMessage = `[Config Debug] Wacht op invoer voor actie: ${actionToMap}...`;
    configInstructions.textContent = logMessage;
    console.log(logMessage);
}));
deadzoneSlider.addEventListener('input', (e) => joystickDeadzone = parseFloat(e.target.value));
Object.keys(colorInputs).forEach(key => colorInputs[key].addEventListener('input', (e) => buttonColorMappings[key] = e.target.value));

window.addEventListener('gamepadconnected', (e) => { gamepadIndex = e.gamepad.index; updateGamepadStatus('Verbonden', 'connected'); previousButtonStates = e.gamepad.buttons.map(b => false); gameLoop(); });
window.addEventListener('gamepaddisconnected', (e) => { if (gamepadIndex === e.gamepad.index) { gamepadIndex = null; updateGamepadStatus('Niet verbonden', 'disconnected'); }});


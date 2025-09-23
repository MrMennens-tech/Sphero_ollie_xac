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

// Aiming state
let isAiming = false;
let aimButtonPressTime = 0;
let lastAimHeading = 0;
const AIM_HOLD_DURATION = 3000; // 3 seconds

// --- UI Update Functions ---
function updateOllieStatus(text, statusClass) {
    ollieStatus.textContent = `Ollie: ${text}`;
    ollieStatusDot.className = `status-dot ${statusClass}`;

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
    ollie.drive(heading, Math.round(speed * maxSpeed));
    isDriving = true;
});

joystickManager.on('end', () => {
    if (!ollie.device || !isDriving) return;
    ollie.drive(ollie.currentHeading, 0);
    isDriving = false;
});

// --- Gamepad API Logic ---
window.addEventListener('gamepadconnected', (e) => {
    console.log('Gamepad connected:', e.gamepad.id);
    gamepadIndex = e.gamepad.index;
    updateGamepadStatus('Verbonden', 'connected');
    previousButtonStates = e.gamepad.buttons.map(b => ({ pressed: b.pressed, value: b.value }));
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
        const toHex = c => ('0'+(c).toString(16)).slice(-2);
        colorPicker.value = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }
}

function updateModeIndicator() {
    let modeText = 'Normaal';
    let modeClass = 'bg-indigo-600';
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

function handleAiming(gp) {
    const x = gp.axes[0];
    const y = -gp.axes[1];
    const deadzone = 0.2;
    const magnitude = Math.sqrt(x * x + y * y);

    if (magnitude > deadzone) {
        let heading = Math.atan2(x, y) * (180 / Math.PI);
        if (heading < 0) heading += 360;
        lastAimHeading = Math.round(heading);
        const spinSpeed = 80;
        // Simple spin based on x-axis
        if (x > 0) {
             ollie.setRawMotors(ollie.Motors.forward, spinSpeed, ollie.Motors.reverse, spinSpeed);
        } else {
             ollie.setRawMotors(ollie.Motors.reverse, spinSpeed, ollie.Motors.forward, spinSpeed);
        }
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
        // Button 6 (X6) is a trigger
        pressed: (index === 6) ? button.value > TRIGGER_THRESHOLD : button.pressed,
        value: button.value
    }));
    
    // CORRECTED BUTTON MAPPING
    const btn_X1 = currentButtonStates[2]; // B2 = Red
    const btn_X2 = currentButtonStates[3]; // B3 = Blue / Aim
    const btn_X3 = currentButtonStates[0]; // B0 = Green
    const btn_X4 = currentButtonStates[1]; // B1 = Yellow
    const btn_X5 = currentButtonStates[4]; // B4 = Speed Down
    const btn_X6 = currentButtonStates[6]; // B6 = Speed Up (Trigger)
    
    const prev_btn_X2 = previousButtonStates[3];
    
    // AIMING LOGIC (uses X2/B3)
    if (btn_X2.pressed && !prev_btn_X2.pressed) {
        aimButtonPressTime = Date.now();
    }

    if (btn_X2.pressed) {
        if (!isAiming && Date.now() - aimButtonPressTime > AIM_HOLD_DURATION) {
            isAiming = true;
            ollie.setBackLed(255); // Turn AIM LED ON
            updateModeIndicator();
        }
    }

    if (!btn_X2.pressed && prev_btn_X2.pressed) {
        if (isAiming) {
            isAiming = false;
            ollie.setHeading(lastAimHeading);
            ollie.setBackLed(0); // Turn AIM LED OFF
            ollie.setRawMotors(ollie.Motors.off, 0, ollie.Motors.off, 0);
            updateModeIndicator();
        } else {
             // Short press of X2/B3
             if (!isTrickMode) applyColor(0, 0, 255); // Set color to blue
             else doTrick('flipForward');
        }
        aimButtonPressTime = 0;
    }

    // MAIN CONTROL LOGIC
    if (isAiming) {
        handleAiming(gp);
    } else {
        // TRICK MODE TOGGLE (X5+X6 / B4+B6)
        const comboPressed = btn_X5.pressed && btn_X6.pressed;
        const prevComboPressed = previousButtonStates[4].pressed && previousButtonStates[6].pressed;
        if (comboPressed && !prevComboPressed) {
            isTrickMode = !isTrickMode;
            updateModeIndicator();
        }

        if (isTrickMode) {
            // TRICK ACTIONS
            if (btn_X1.pressed && !previousButtonStates[2].pressed) doTrick('spinLeft');
            if (btn_X3.pressed && !previousButtonStates[0].pressed) doTrick('flipBackward');
            if (btn_X4.pressed && !previousButtonStates[1].pressed) doTrick('spinRight');
        } else {
            // NORMAL ACTIONS
            if (btn_X5.pressed && !previousButtonStates[4].pressed) changeMaxSpeed(-0.1);
            if (btn_X6.pressed && !previousButtonStates[6].pressed) changeMaxSpeed(0.1);
            if (btn_X1.pressed && !previousButtonStates[2].pressed) applyColor(255, 0, 0);   // Red
            if (btn_X3.pressed && !previousButtonStates[0].pressed) applyColor(0, 255, 0);   // Green
            if (btn_X4.pressed && !previousButtonStates[1].pressed) applyColor(255, 255, 0); // Yellow

            // DRIVING LOGIC
            const x = gp.axes[0];
            const y = -gp.axes[1];
            const magnitude = Math.sqrt(x * x + y * y);
            
            // NEW: Stepped speed control
            let speed = 0;
            if (magnitude > 0.9) {
                speed = 255; // Fast
            } else if (magnitude > 0.6) {
                speed = 170; // Medium
            } else if (magnitude > 0.2) {
                speed = 85;  // Slow
            }

            if (speed > 0) {
                isDriving = true;
                let heading = Math.atan2(x, y) * (180 / Math.PI);
                if (heading < 0) heading += 360;
                
                ollie.drive(Math.round(heading), Math.round(speed * maxSpeed));
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
            console.log('Putting Ollie to sleep before disconnecting...');
            await ollie.sleep();
            // NEW: Wait for sleep command to process before disconnecting
            setTimeout(() => {
                ollie.disconnect();
            }, 300); 
        } catch (error) {
            console.error('Failed to send sleep command, disconnecting anyway.', error);
            ollie.disconnect();
        }
    } else {
        try {
            updateOllieStatus('Zoeken...', 'connecting');
            
            const handleDisconnect = () => {
                updateOllieStatus('Niet verbonden', 'disconnected');
            };

            await ollie.request(handleDisconnect);
            
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


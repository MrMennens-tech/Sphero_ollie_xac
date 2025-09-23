Startpagina
Financieel
Reizen
Academisch
Sport
Library
Ik wil een app maken die: [https://github.com/binomed/sphero_ollie-web-bluetooth](https://github.com
zijn zelesta dekbedden echt goed of is het een grote marketing stunt?
1247 is de hoogte in mm van mijn kast, ik wil 5 gedeeltes maken om kleding neer te leggen. de planke
als ik deze wil vervangen voor hetzelfde type, welke moet ik dan nu hebben? geef ook een link naar d
is het mogelijk om in Bambi Studio iets van een swirl effect te creëren met multicolor paint modus?
thule omnistor elektrisch
Dit product wil ik graag kopen in nederland... zoek dit!
waar vind ik zo'n profiel?
Remis Remiflair I Combirollo
ik wil een dfplayer mini koppelen aan een rp2040 bordje , aan dit bordje wil ik ook een ws2810 led r
Bekijk alles
Startpagina
Ontdekken
Ruimtes
Account

Upgrade
User avatar
Ik wil een app maken die:
https://github.com/binomed/sphero_ollie-web-bluetooth gebruikt, maar extra functionaliteit heeft. Ik wil namelijk een USB joystick (xbox adaptive joystick) gebruiken om de sphero ollie te besturen.

Maak een web app (duplicaat van de binomed github) maar voeg de controle toe van de controller

Ik wil een app maken die: https://github.com/binomed/sphero_ollie-web-bluetooth gebruikt, maar extra functionaliteit heeft. Ik wil namelijk een USB joystick (xbox adaptive joystick) gebruiken om de sphero ollie te besturen. Maak een web app (duplicaat van de binomed github) maar voeg de controle toe van de controller
<!DOCTYPE html>
<html lang="nl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sphero Ollie Controller</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="container">
        <header class="app-header">
            <h1>Sphero Ollie Controller</h1>
            <p>Bestuur je Sphero Ollie met Xbox Adaptive Controller</p>
        </header>
        <main class="app-main">
            <!-- Bluetooth Section -->
            <section class="card connection-section">
                <div class="card__header">
                    <h2>Bluetooth Verbinding</h2>
                    <div class="status bluetooth-status">
                        <span class="status--error" id="bluetooth-status">Niet verbonden</span>
                    </div>
                </div>
                <div class="card__body">
                    <button class="btn btn--primary" id="connect-btn">Verbind met Sphero Ollie</button>
                    <button class="btn btn--outline" id="disconnect-btn" disabled>Verbinding verbreken</button>
                    <p class="connection-info" id="connection-info">Klik op 'Verbind met Sphero Ollie' om te beginnen.</p>
                </div>
            </section>
            <!-- Gamepad Section -->
            <section class="card gamepad-section">
                <div class="card__header">
                    <h2>Gamepad Bediening</h2>
                    <div class="status gamepad-status">
                        <span class="status--error" id="gamepad-status">Niet verbonden</span>
                    </div>
                </div>
                <div class="card__body">
                    <div class="gamepad-info">
                        <p>Sluit je Xbox Adaptive Controller aan via USB voor automatische detectie.</p>
                        <div class="gamepad-controls">
                            <div class="control-group">
index.html
:root {
style.css
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
app.js
sphero-gamepad-controller.zip
sphero-gamepad-controller.zip
index.html
Gegenereerd Bestand
<!DOCTYPE html>
<html lang="nl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sphero Ollie Controller</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="container">
        <header class="app-header">
            <h1>Sphero Ollie Controller</h1>
            <p>Bestuur je Sphero Ollie met Xbox Adaptive Controller</p>
        </header>

        <main class="app-main">
            <!-- Bluetooth Section -->
            <section class="card connection-section">
                <div class="card__header">
                    <h2>Bluetooth Verbinding</h2>
                    <div class="status bluetooth-status">
                        <span class="status--error" id="bluetooth-status">Niet verbonden</span>
                    </div>
                </div>
                <div class="card__body">
                    <button class="btn btn--primary" id="connect-btn">Verbind met Sphero Ollie</button>
                    <button class="btn btn--outline" id="disconnect-btn" disabled>Verbinding verbreken</button>
                    <p class="connection-info" id="connection-info">Klik op 'Verbind met Sphero Ollie' om te beginnen.</p>
                </div>
            </section>

            <!-- Gamepad Section -->
            <section class="card gamepad-section">
                <div class="card__header">
                    <h2>Gamepad Bediening</h2>
                    <div class="status gamepad-status">
                        <span class="status--error" id="gamepad-status">Niet verbonden</span>
                    </div>
                </div>
                <div class="card__body">
                    <div class="gamepad-info">
                        <p>Sluit je Xbox Adaptive Controller aan via USB voor automatische detectie.</p>
                        <div class="gamepad-controls">
                            <div class="control-group">
                        
Asset 1 van 3

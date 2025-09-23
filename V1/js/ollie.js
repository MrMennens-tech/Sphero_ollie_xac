/**
 * Ollie.js
 * This file contains the Ollie class for connecting and sending commands to the Sphero Ollie robot.
 * This version is based on the original work by binomed, adapted for this project.
 */
export class Ollie {
    constructor() {
        this.device = null;
        this.onDisconnectedCallback = null;
        this.sequence = 0;
        this.isBusy = false; // Command queue flag
        this.currentHeading = 0;
        this.controlCharacteristic = null;
        this.batteryCharacteristic = null; // Store the battery characteristic

        this.Motors = {
            off: 0x00, forward: 0x01, reverse: 0x02,
        };

        // Constants for BLE services and characteristics
        this.services = {
            RADIO: "22bb746f-2bb0-7554-2d6f-726568705327",
            ROBOT: "22bb746f-2ba0-7554-2d6f-726568705327",
            BATTERY: 0x180F, // Standard Bluetooth Battery Service
        };
        this.characteristics = {
            CONTROL: "22bb746f-2ba1-7554-2d6f-726568705327",
            ANTIDOS: "22bb746f-2bbd-7554-2d6f-726568705327",
            POWER: "22bb746f-2bb2-7554-2d6f-726568705327",
            WAKE: "22bb746f-2bbf-7554-2d6f-726568705327",
            BATTERY_LEVEL: 0x2A19, // Standard Battery Level Characteristic
        };
    }

    async request(onDisconnected) {
        this.onDisconnectedCallback = onDisconnected;
        const options = {
            filters: [{ services: [this.services.ROBOT] }],
            optionalServices: [this.services.RADIO, this.services.BATTERY] // Request access to the standard battery service
        };
        this.device = await navigator.bluetooth.requestDevice(options);
        this.device.addEventListener('gattserverdisconnected', this.onDisconnected.bind(this));
        return this.device;
    }

    connect() {
        if (!this.device) return Promise.reject('Device not requested yet.');
        return this.device.gatt.connect();
    }

    onDisconnected() {
        console.log('--- OLLIE DISCONNECTED --- Device object is now null.');
        this.controlCharacteristic = null;
        this.batteryCharacteristic = null;
        this.device = null;
        if (this.onDisconnectedCallback) {
            this.onDisconnectedCallback();
        }
    }

    async init() {
        try {
            console.log('> Initializing Ollie...');

            // Step 1: Set up the control characteristic listener first.
            console.log('> Setting up control listener...');
            const robotService = await this.device.gatt.getPrimaryService(this.services.ROBOT);
            this.controlCharacteristic = await robotService.getCharacteristic(this.characteristics.CONTROL);
            console.log('> Control listener activated.');

            // Step 2: Now that we have the characteristic, send the wake-up sequence.
            await this._writeCharacteristic(this.services.RADIO, this.characteristics.ANTIDOS, new Uint8Array('011i3'.split('').map(c => c.charCodeAt(0))));
            console.log('> Wrote Anti DOS characteristic');
            await this._writeCharacteristic(this.services.RADIO, this.characteristics.POWER, new Uint8Array([0x07]));
            console.log('> Wrote TX Power characteristic');
            await this._writeCharacteristic(this.services.RADIO, this.characteristics.WAKE, new Uint8Array([0x01]));
            console.log('> Wrote Wake CPU characteristic');
            
            // Step 3: Finalize the setup.
            await this.setBackLed(0);
            console.log('> Back LED set to off');
            await this.setHeading(0);
            console.log('> Heading set, device is ready!');
        } catch (error) {
            console.error(">>> CRITICAL ERROR during Ollie initialization:", error);
            if (this.device && this.device.gatt.connected) this.device.gatt.disconnect();
            throw error;
        }
    }
    
    // --- Public Command Methods ---
    drive(heading, speed) { this.currentHeading = heading; return this._sendCommand(0x02, 0x30, new Uint8Array([speed, heading >> 8, heading & 0xFF, 1])); }
    stop() { return this.setRawMotors(this.Motors.off, 0, this.Motors.off, 0); }
    setColor(r, g, b) { return this._sendCommand(0x02, 0x20, new Uint8Array([r, g, b, 0])); }
    setBackLed(brightness) { return this._sendCommand(0x02, 0x21, new Uint8Array([brightness])); }
    setHeading(heading) { return this._sendCommand(0x02, 0x01, new Uint8Array([heading >> 8, heading & 0xFF])); }
    setRawMotors(lmode, lpower, rmode, rpower) { return this._sendCommand(0x02, 0x33, new Uint8Array([lmode, lpower, rmode, rpower])); }
    async sleep() { await this.setBackLed(0); return this._sendCommand(0x00, 0x22, new Uint8Array([0])); }
    disconnect() { if (this.device) this.device.gatt.disconnect(); }
    
    // --- NEW SIMPLIFIED AND CORRECTED BATTERY LOGIC ---
    _handleBatteryResponse(event) {
        const batteryLevel = event.target.value.getUint8(0);
        console.log(`> Battery Update Received: ${batteryLevel}%`);
        if (this.batteryUpdateCallback) {
            this.batteryUpdateCallback(batteryLevel);
        }
    }

    async startBatteryUpdates(callback) {
        if (!this.device || !this.device.gatt.connected) throw new Error("Device not connected.");
        this.batteryUpdateCallback = callback;
        try {
            console.log('> Starting battery updates using standard service...');
            const service = await this.device.gatt.getPrimaryService(this.services.BATTERY);
            this.batteryCharacteristic = await service.getCharacteristic(this.characteristics.BATTERY_LEVEL);
            this.batteryCharacteristic.addEventListener('characteristicvaluechanged', this._handleBatteryResponse.bind(this));
            await this.batteryCharacteristic.startNotifications();
            console.log('> Battery notifications started successfully.');
            // Also read the initial value
            const initialValue = await this.batteryCharacteristic.readValue();
            this._handleBatteryResponse({ target: { value: initialValue } });

        } catch (error) {
            console.error(">>> FAILED to start battery updates:", error);
        }
    }

    async stopBatteryUpdates() {
        if (this.batteryCharacteristic) {
            try {
                await this.batteryCharacteristic.stopNotifications();
                this.batteryCharacteristic.removeEventListener('characteristicvaluechanged', this._handleBatteryResponse);
                this.batteryCharacteristic = null;
                console.log('> Stopped battery updates.');
            } catch(error) {
                console.error("Could not stop battery notifications:", error);
            }
        }
    }

    // --- Private BLE Methods ---
    async _sendCommand(did, cid, data) {
        if (this.isBusy) return Promise.resolve();
        this.isBusy = true;

        const seq = this.sequence & 255; this.sequence++;
        const sop2 = 0xfc | 1 | 2;
        const dlen = data.byteLength + 1;
        const sum = data.reduce((a, b) => a + b, 0);
        const chk = (sum + did + cid + seq + dlen) & 255 ^ 255;
        const packets = new Uint8Array(6 + data.byteLength + 1);
        packets.set([0xff, sop2, did, cid, seq, dlen]);
        packets.set(data, 6);
        packets.set([chk], 6 + data.byteLength);

        try {
            if (this.controlCharacteristic) {
                await this.controlCharacteristic.writeValue(packets);
            } else { console.error('Cannot send command: Control Characteristic not available.'); }
        } catch (error) { console.error('Failed to send command:', error); } 
        finally { this.isBusy = false; }
    }

    async _writeCharacteristic(serviceUID, characteristicUID, value) {
        if (!this.device?.gatt.connected) return Promise.reject(new Error('Device not connected'));
        const service = await this.device.gatt.getPrimaryService(serviceUID);
        const characteristic = await service.getCharacteristic(characteristicUID);
        return characteristic.writeValue(value);
    }
}


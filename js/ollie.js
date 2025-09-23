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

        this.Motors = {
            off: 0x00, forward: 0x01, reverse: 0x02,
        };

        // Constants for BLE services and characteristics
        this.services = {
            RADIO: "22bb746f-2bb0-7554-2d6f-726568705327",
            ROBOT: "22bb746f-2ba0-7554-2d6f-726568705327",
            BATTERY: "0000180f-0000-1000-8000-00805f9b34fb" // Standard Battery Service
        };
        this.characteristics = {
            CONTROL: "22bb746f-2ba1-7554-2d6f-726568705327",
            ANTIDOS: "22bb746f-2bbd-7554-2d6f-726568705327",
            POWER: "22bb746f-2bb2-7554-2d6f-726568705327",
            WAKE: "22bb746f-2bbf-7554-2d6f-726568705327",
            BATTERY_LEVEL: "00002a19-0000-1000-8000-00805f9b34fb" // Standard Battery Level
        };
    }

    async request(onDisconnected) {
        this.onDisconnectedCallback = onDisconnected;
        const options = {
            filters: [{ services: [this.services.ROBOT] }],
            optionalServices: [this.services.RADIO, this.services.BATTERY]
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
        this.device = null;
        if (this.onDisconnectedCallback) {
            this.onDisconnectedCallback();
        }
    }

    async init() {
        console.log('> Initializing Ollie...');
        await this._writeCharacteristic(this.services.RADIO, this.characteristics.ANTIDOS, new Uint8Array('011i3'.split('').map(c => c.charCodeAt(0))));
        console.log('> Wrote Anti DOS characteristic');
        await this._writeCharacteristic(this.services.RADIO, this.characteristics.POWER, new Uint8Array([0x07]));
        console.log('> Wrote TX Power characteristic');
        await this._writeCharacteristic(this.services.RADIO, this.characteristics.WAKE, new Uint8Array([0x01]));
        console.log('> Wrote Wake CPU characteristic');
        await this.setBackLed(0); // Ensure back LED is off on start
        console.log('> Back LED set to off');
        await this.setHeading(0);
        console.log('> Heading set, device is ready!');
    }
    
    // --- Public Command Methods ---
    drive(heading, speed) {
        this.currentHeading = heading;
        const did = 0x02, cid = 0x30;
        const data = new Uint8Array([speed, heading >> 8, heading & 0xFF, 1]);
        return this._sendCommand(did, cid, data);
    }
    setColor(r, g, b) {
        const did = 0x02, cid = 0x20;
        const data = new Uint8Array([r, g, b, 0]);
        return this._sendCommand(did, cid, data);
    }
    setBackLed(brightness) {
        const did = 0x02, cid = 0x21;
        const data = new Uint8Array([brightness]);
        return this._sendCommand(did, cid, data);
    }
    setHeading(heading) {
        const did = 0x02, cid = 0x01;
        const data = new Uint8Array([heading >> 8, heading & 0xFF]);
        return this._sendCommand(did, cid, data);
    }
    setRawMotors(lmode, lpower, rmode, rpower) {
        const did = 0x02, cid = 0x33;
        const data = new Uint8Array([lmode, lpower, rmode, rpower]);
        return this._sendCommand(did, cid, data);
    }
    async sleep() {
        await this.setBackLed(0);
        const did = 0x00, cid = 0x22;
        return this._sendCommand(did, cid, new Uint8Array([0]));
    }
    disconnect() {
        if (!this.device) return;
        this.device.gatt.disconnect();
    }
    
    async getBatteryLevel() {
        if (!this.device || !this.device.gatt.connected) throw new Error("Device not connected.");
        try {
            const service = await this.device.gatt.getPrimaryService(this.services.BATTERY);
            const characteristic = await service.getCharacteristic(this.characteristics.BATTERY_LEVEL);
            const value = await characteristic.readValue();
            return value.getUint8(0);
        } catch (error) {
            console.error('Standard battery service not found. This Ollie may not support it.', error);
            throw error;
        }
    }

    // --- Private BLE Methods ---
    async _sendCommand(did, cid, data) {
        if (this.isBusy) {
            // console.warn('Ollie is busy, command dropped.');
            return Promise.resolve(); // Don't reject, just ignore the command
        }
        this.isBusy = true;

        const seq = this.sequence & 255;
        this.sequence++;
        const sop2 = 0xfc | 1 | 2;
        const dlen = data.byteLength + 1;
        const sum = data.reduce((a, b) => a + b, 0);
        const chk = (sum + did + cid + seq + dlen) & 255 ^ 255;

        const packets = new Uint8Array(6 + data.byteLength + 1);
        packets.set([0xff, sop2, did, cid, seq, dlen]);
        packets.set(data, 6);
        packets.set([chk], 6 + data.byteLength);

        try {
            await this._writeCharacteristic(this.services.ROBOT, this.characteristics.CONTROL, packets);
        } catch (error) {
            console.error('Failed to send command:', error);
        } finally {
            this.isBusy = false;
        }
    }

    async _writeCharacteristic(serviceUID, characteristicUID, value) {
        if (!this.device?.gatt.connected) {
            console.error('Write failed: Not connected.');
            return;
        }
        const service = await this.device.gatt.getPrimaryService(serviceUID);
        const characteristic = await service.getCharacteristic(characteristicUID);
        return characteristic.writeValue(value);
    }
}


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
        };
        this.characteristics = {
            CONTROL: "22bb746f-2ba1-7554-2d6f-726568705327",
            ANTIDOS: "22bb746f-2bbd-7554-2d6f-726568705327",
            POWER: "22bb746f-2bb2-7554-2d6f-726568705327", 
            WAKE: "22bb746f-2bbf-7554-2d6f-726568705327",
        };
    }

    async request(onDisconnected) {
        this.onDisconnectedCallback = onDisconnected;
        const options = {
            filters: [{ services: [this.services.ROBOT] }],
            optionalServices: [this.services.RADIO]
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
        await this.setBackLed(0);
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
    stop() {
        // This provides a more forceful stop than drive(0,0)
        return this.setRawMotors(this.Motors.off, 0, this.Motors.off, 0);
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
    
    async startBatteryUpdates(callback) {
        if (!this.device || !this.device.gatt.connected) throw new Error("Device not connected.");
        try {
            const service = await this.device.gatt.getPrimaryService(this.services.ROBOT);
            const characteristic = await service.getCharacteristic('22bb746f-2bb1-7554-2d6f-726568705327'); // This is the correct notification characteristic

            characteristic.addEventListener('characteristicvaluechanged', (event) => {
                const value = event.target.value;
                if (value.getUint8(0) === 0x8d && value.getUint8(1) === 0x0a && value.getUint8(4) === 0x13) {
                    const voltage = value.getUint16(5, false) / 100.0; // big-endian
                    const minVoltage = 7.0, maxVoltage = 8.4;
                    const percentage = Math.round(((voltage - minVoltage) / (maxVoltage - minVoltage)) * 100);
                    const clampedPercentage = Math.max(0, Math.min(100, percentage));
                    if (callback) callback(clampedPercentage);
                }
            });

            await characteristic.startNotifications();
            console.log('> Started listening for response notifications.');
            
            const did = 0x00, cid = 0x21, data = new Uint8Array([0x01]);
            await this._sendCommand(did, cid, data);
            console.log('> Enabled power notifications on Ollie.');
        } catch (error) {
            console.error('Failed to start battery updates.', error);
            throw error;
        }
    }

    async stopBatteryUpdates() {
        if (!this.device || !this.device.gatt.connected) return;
        try {
            const service = await this.device.gatt.getPrimaryService(this.services.ROBOT);
            const characteristic = await service.getCharacteristic('22bb746f-2bb1-7554-2d6f-726568705327');
            if (characteristic.properties.notify) {
                await characteristic.stopNotifications();
                console.log('> Stopped listening for response notifications.');
            }
        } catch (error) {
            console.warn('Could not stop battery notifications.', error);
        }
    }

    // --- Private BLE Methods ---
    async _sendCommand(did, cid, data) {
        if (this.isBusy) {
            return Promise.resolve();
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


'use strict'

// This file is now based on the proven library code from the original GitHub repository.
// I've adapted it to use modern async/await and ES modules (`export`) for compatibility with our project.

/**
 * General configuration (UUIDs for Bluetooth services and characteristics)
 */
class Config {
    radioService() { return "22bb746f-2bb0-7554-2d6f-726568705327" }
    robotService() { return "22bb746f-2ba0-7554-2d6f-726568705327" }
    controlCharacteristic() { return "22bb746f-2ba1-7554-2d6f-726568705327" }
    antiDOSCharateristic() { return "22bb746f-2bbd-7554-2d6f-726568705327" }
    powerCharateristic() { return "22bb746f-2bb2-7554-2d6f-726568705327" }
    wakeUpCPUCharateristic() { return "22bb746f-2bbf-7554-2d6f-726568705327" }
}

/**
 * Class for the robot
 * */
export class Ollie {
    constructor() {
        this.device = null;
        this.config = new Config();
        this.sequence = 0;
        this.isBusy = false; // Flag to prevent command flooding
        this.Motors = {
            off: 0x00,
            forward: 0x01,
            reverse: 0x02,
        };
        this.currentHeading = 0;
        this.onDisconnectCallback = null;
        this.onDisconnected = this.onDisconnected.bind(this);
    }

    async request(onDisconnect) {
        this.onDisconnectCallback = onDisconnect;
        let options = {
            "filters": [{
                "services": [this.config.radioService()]
            }, {
                "services": [this.config.robotService()]
            }],
            "optionalServices": [this.config.radioService(), this.config.robotService()]
        };
        this.device = await navigator.bluetooth.requestDevice(options);
        this.device.addEventListener('gattserverdisconnected', this.onDisconnected);
    }

    async connect() {
        if (!this.device) {
            throw new Error('Device is not requested yet.');
        }
        await this.device.gatt.connect();
    }

    async init() {
        if (!this.device) {
            throw new Error('Device is not connected.');
        }
        console.log('> Initializing Ollie...');
        await this._writeCharacteristic(this.config.radioService(), this.config.antiDOSCharateristic(), new Uint8Array('011i3'.split('').map(c => c.charCodeAt(0))));
        console.log('> Wrote Anti DOS characteristic');
        await this._writeCharacteristic(this.config.radioService(), this.config.powerCharateristic(), new Uint8Array([0x07]));
        console.log('> Wrote TX Power characteristic');
        await this._writeCharacteristic(this.config.radioService(), this.config.wakeUpCPUCharateristic(), new Uint8Array([0x01]));
        console.log('> Wrote Wake CPU characteristic');
        await this.setBackLed(0);
        console.log('> Back LED set to off');
        await this.setHeading(0);
        console.log('> Heading set, device is ready!');
    }
    
    async drive(heading, speed) {
        this.currentHeading = heading;
        let did = 0x02;
        let cid = 0x30;
        let data = new Uint8Array([speed, heading >> 8, heading & 0xFF, 1]);
        await this._sendCommand(did, cid, data);
    }
    
    async setColor(red, green, blue) {
        let did = 0x02;
        let cid = 0x20;
        let data = new Uint8Array([red, green, blue, 1]);
        await this._sendCommand(did, cid, data);
    }
    
    async setRawMotors(lmode, lpower, rmode, rpower) {
        let did = 0x02;
        let cid = 0x33;
        let data = new Uint8Array([lmode, lpower, rmode, rpower]);
        await this._sendCommand(did, cid, data);
    }

    async setBackLed(brightness) {
        let did = 0x02;
        let cid = 0x21;
        let data = new Uint8Array([brightness]);
        await this._sendCommand(did, cid, data);
    }

    async setHeading(heading) {
        let did = 0x02;
        let cid = 0x01;
        let data = new Uint8Array([heading >> 8, heading & 0xFF]);
        await this._sendCommand(did, cid, data);
    }

    async sleep() {
        console.log('> Putting Ollie to sleep...');
        const did = 0x00; // Core device ID
        const cid = 0x22; // Sleep command ID
        const data = new Uint8Array([0x00]); // Sleep now
        await this._sendCommand(did, cid, data);
    }

    disconnect() {
        if (!this.device) {
            return;
        }
        this.device.gatt.disconnect();
    }

    onDisconnected() {
        console.log('--- OLLIE DISCONNECTED --- Device object is now null.');
        this.device = null;
        if (this.onDisconnectCallback) {
            this.onDisconnectCallback();
        }
    }

    async _sendCommand(did, cid, data) {
        if (this.isBusy) {
            // console.log('Command dropped, Ollie is busy.');
            return; // Drop command if another is in progress
        }
        
        this.isBusy = true;
        try {
            let seq = this.sequence & 255;
            this.sequence += 1;
            let dlen = data.byteLength + 1;
            let sum = data.reduce((a, b) => a + b, 0);
            let chk = (sum + did + cid + seq + dlen) & 255;
            chk ^= 255;
            let checksum = new Uint8Array([chk]);
            let packets = new Uint8Array([0xff, 0xff, did, cid, seq, dlen]);
            let array = new Uint8Array(packets.byteLength + data.byteLength + checksum.byteLength);
            array.set(packets, 0);
            array.set(data, packets.byteLength);
            array.set(checksum, packets.byteLength + data.byteLength);
            await this._writeCharacteristic(this.config.robotService(), this.config.controlCharacteristic(), array);
        } catch(error) {
            console.error("Error sending command:", error);
        } finally {
            this.isBusy = false; // Release the lock
        }
    }

    async _writeCharacteristic(serviceUID, characteristicUID, value) {
        const service = await this.device.gatt.getPrimaryService(serviceUID);
        const characteristic = await service.getCharacteristic(characteristicUID);
        await characteristic.writeValue(value);
    }
}


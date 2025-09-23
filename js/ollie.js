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
        this.Motors = {
            off: 0x00,
            forward: 0x01,
            reverse: 0x02,
        };
        this.currentHeading = 0; // Added to keep track of heading
    }

    async request() {
        let options = {
            "filters": [{
                "services": [this.config.radioService()]
            }, {
                "services": [this.config.robotService()]
            }],
            "optionalServices": [this.config.radioService(), this.config.robotService()]
        };
        this.device = await navigator.bluetooth.requestDevice(options);
        this.device.addEventListener('gattserverdisconnected', () => this.onDisconnected());
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
        await this._sendCommand(0x02, 0x21, new Uint8Array([127])); // Set BackLed
        console.log('> Back LED set');
        await this._sendCommand(0x02, 0x01, new Uint8Array([0 >> 8, 0 & 0xFF])); // Set Heading
        console.log('> Heading set, device is ready!');
    }
    
    // The library uses processMotor, we'll keep that name
    async drive(heading, speed) {
        this.currentHeading = heading;
        let did = 0x02; // Virtual device ID
        let cid = 0x30; // Roll command
        let data = new Uint8Array([speed, heading >> 8, heading & 0xFF, 1]);
        await this._sendCommand(did, cid, data);
    }
    
    // The library uses processColor, we'll keep that name
    async setColor(red, green, blue) {
        let did = 0x02; // Virtual device ID
        let cid = 0x20; // Set RGB LED Output command
        let data = new Uint8Array([red, green, blue, 1]); // Flag 1 to save color
        await this._sendCommand(did, cid, data);
    }
    
    async setRawMotors(lmode, lpower, rmode, rpower) {
        let did = 0x02; // Virtual device ID
        let cid = 0x33; // Set raw Motors command
        let data = new Uint8Array([lmode, lpower, rmode, rpower]);
        await this._sendCommand(did, cid, data);
    }

    disconnect() {
        if (!this.device) {
            return;
        }
        this.device.gatt.disconnect();
    }

    onDisconnected() {
        console.log('Device is disconnected.');
        this.device = null;
        // The main script will handle UI updates via the event listener
    }

    async _sendCommand(did, cid, data) {
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
    }

    async _writeCharacteristic(serviceUID, characteristicUID, value) {
        const service = await this.device.gatt.getPrimaryService(serviceUID);
        const characteristic = await service.getCharacteristic(characteristicUID);
        await characteristic.writeValue(value);
    }
}


// Based on https://github.com/binomed/sphero_ollie-web-bluetooth/blob/master/lib.js
export class Ollie {
    constructor() {
        this.device = null;
        this.services = {};
        this.characteristics = {};
        this.sequence = 0;
        this.currentHeading = 0;
    }

    async connect() {
        console.log('Requesting Bluetooth device...');
        
        // This is a more robust filter. It looks for devices that EITHER
        // have the name "Ollie" OR broadcast the official Sphero service UUID.
        // This should solve the connection issue.
        this.device = await navigator.bluetooth.requestDevice({
            filters: [
                { namePrefix: 'Ollie' },
                { services: ['22bb746f-2bb0-7554-2d6f-726568705327'] }
            ],
            optionalServices: [
                '22bb746f-2bb0-7554-2d6f-726568705327', 
                '22bb746f-2bbf-7554-2d6f-726568705327'
            ]
        });
        
        this.device.addEventListener('gattserverdisconnected', () => this.onDisconnected());
        
        console.log('Connecting to GATT Server...');
        const server = await this.device.gatt.connect();

        console.log('Getting services...');
        const services = await server.getPrimaryServices();

        for (const service of services) {
            this.services[service.uuid] = service;
            const characteristics = await service.getCharacteristics();
            for (const characteristic of characteristics) {
                this.characteristics[characteristic.uuid] = characteristic;
            }
        }

        console.log('Ollie connected, initializing...');
        await this.init();
    }

    onDisconnected() {
        console.log('Ollie disconnected');
        this.device = null;
        // The main script will handle UI updates.
    }

    async init() {
        console.log('Initializing Ollie Anti-DOS...');
        const useAntiDos = this.characteristics['22bb746f-2bb1-7554-2d6f-726568705327'];
        await useAntiDos.writeValue(new TextEncoder().encode('011i3'));
        await this.wake();
    }

    getNextSequence() {
        this.sequence = (this.sequence + 1) % 256;
        return this.sequence;
    }
    
    async sendCommand(did, cid, data = []) {
        if (!this.device || !this.device.gatt.connected) {
            console.warn('Cannot send command, Ollie not connected.');
            return;
        }
        const sequence = this.getNextSequence();
        const dataLength = data.length + 1;
        const checksum = (~((did + cid + sequence + dataLength + data.reduce((a, b) => a + b, 0)) & 0xFF)) & 0xFF;
        const command = new Uint8Array([0xFF, 0xFF, did, cid, sequence, dataLength, ...data, checksum]);
        try {
            await this.characteristics['22bb746f-2bb2-7554-2d6f-726568705327'].writeValue(command);
        } catch (error) {
            console.error('Error sending command:', error);
        }
    }

    async wake() {
        console.log('Waking Ollie...');
        await this.sendCommand(0x02, 0x13, [0x01]);
    }

    async setColor(r, g, b) {
        console.log(`Setting color to rgb(${r}, ${g}, ${b})`);
        await this.sendCommand(0x02, 0x20, [r, g, b, 0x01]);
    }
    
    async drive(speed, heading, state = 1) {
        this.currentHeading = heading;
        let clampedSpeed = Math.max(0, Math.min(255, speed));
        let clampedHeading = Math.round(heading % 360);
        const headingHigh = clampedHeading >> 8;
        const headingLow = clampedHeading & 0xFF;
        await this.sendCommand(0x02, 0x30, [clampedSpeed, headingHigh, headingLow, state]);
    }

    async setRawMotors(leftMode, leftSpeed, rightMode, rightSpeed) {
        await this.sendCommand(0x02, 0x33, [leftMode, leftSpeed, rightMode, rightSpeed]);
    }
}

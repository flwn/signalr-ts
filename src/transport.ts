///<reference path="./_wire.d.ts" />
import {Connection}  from './connection';


export class MessageSink {
    private _onInit: () => void;

    private messageBuffer = [];

    constructor(private connection: Connection) {
    }

    handleMessage(transport: Transport, message: RawMessageData) {
        if (typeof message !== "object" || message === null) {
            console.warn('Unsupported message format received');
            return;
        }

        this.connection.markLastMessage();

        if (Object.keys(message).length === 0) {
            //keep alive
            return;
        }

        if (!this.transportActive) {
            this.messageBuffer.push(message);

            if (typeof (message.S) !== "undefined") {
                console.log('MessageSink: init received', message.S);
                this.transportActive = true;
                transport.setInitialized(message.S);
                this.drain();
            }
        } else {
            this.connection.handleData(message);
        }
    }

    transportActive: boolean = false;

    transportError(e: Error) {
        //todo: handle errors.
    }

    drain() {
        while (this.messageBuffer.length > 0) {

            let message = this.messageBuffer.shift();

            this.connection.handleData(message);
        }
    }

    clear() {
        this.messageBuffer = [];
    }
}

export enum TransportState {
    Initializing,
    Opened,
    Ready,
    Closed
}

export abstract class Transport {


    private _onInit: () => void;

    name: string;
    abstract send(data: any): Promise<any>;
    abstract close(): Promise<boolean>;
    abstract connect(): Promise<void>;
    get supportsKeepAlive(): boolean {
        return false;
    }

    setInitialized(correlationId: number): void {
        if (this._state != TransportState.Opened) {
            throw new Error('transport not opened');
        }
        this._state = TransportState.Ready;
        if (!this._onInit) {
            console.warn('No _onInit handler...');
        } else {
            this._onInit();
        }
    }

    protected _state: TransportState = TransportState.Initializing;

    waitForInit(timeout: number): Promise<any> {
        if (this._state < TransportState.Ready) {

            return new Promise((resolve, reject) => {
                let rejectTimeout = setTimeout(() =>
                    reject(new Error(`Timout: Could not initialize transport within ${timeout}ms.`)),
                    timeout);

                this._onInit = () => {
                    clearTimeout(rejectTimeout);
                    resolve();
                    delete this._onInit;
                }
            });
        }
        console.log('transport already initialized.');
        
        if (this._state === TransportState.Ready) {
            return Promise.resolve(true);
        }
        return Promise.reject(new Error('Transport already closed'));
    }

}
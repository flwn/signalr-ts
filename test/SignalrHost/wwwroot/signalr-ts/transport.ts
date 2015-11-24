///<reference path="./_wire.d.ts" />
import {Connection}  from './connection';


export class MessageSink {
    private _onInit: () => void;

    private messageBuffer = [];

    constructor(private connection: Connection) {
    }

    handleMessage(transport: Transport, data: string) {
        if (typeof data !== "string" || data.length === 0) {
            console.warn('Unsupported message format received');
            return;
        }

        this.connection.markLastMessage();

        if (data === '{}') {
            //keep alive
            return;
        }

        let message = <RawMessageData>JSON.parse(data);

        if (!this.transportActive) {
            this.messageBuffer.push(message);

            if (typeof (message.S) !== "undefined") {
                console.log('MessageSink: init received', message.S);
                this.transportActive = true;
                transport.setInitialized(message.S);
                this.drain();
            }
        }

        this.connection.handleData(message);
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

export interface Transport {
    name: string;
    send(data: any): Promise<any>;
    close(): Promise<boolean>;
    connect(): Promise<void>;
    waitForInit(timeout: number): Promise<any>;
    supportsKeepAlive: boolean;
    setInitialized(correlationId: number): void;
}
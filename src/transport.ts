///<reference path="./_wire.d.ts" />
import {Connection}  from './connection';
import {getLogger} from './logging';


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

        if (typeof message.C !== "undefined") {
            transport.lastMessageId = message.C;
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

enum SocketState {
    /**
     * The connection is not yet open.
     */
    CONNECTING = 0,
    /**
     * The connection is open and ready to communicate.
     */
    OPEN = 1,
    /**
     * The connection is in the process of closing.
     */
    CLOSING = 2,
    /**
     * The connection is closed or couldn't be opened.
     */
    CLOSED = 3
}

export enum TransportState {
    Initializing,
    Opened,
    Ready,
    Closed
}

export interface SocketAlike {
    onclose: (ev: CloseEvent) => any;
    onerror: (ev: ErrorEvent) => any;
    onmessage: (ev: MessageEvent) => any;
    onopen: (ev: Event) => any;
    readyState: number;
    close(code?: number, reason?: string): void;
    send(data: any): void;
}

export abstract class Transport {
    private _onInit: () => void;
    protected _socket: SocketAlike = null;
    private _onClose: (cleanClose: boolean) => void;


    constructor(private _sink: MessageSink) {
    }


    name: string;

    connectionLost: (transport: this) => void;

    abstract send(data: any): Promise<any>;

    protected abstract connectSocket(reconnect: boolean): SocketAlike;

    get supportsKeepAlive(): boolean {
        return false;
    }

    setInitialized(correlationId: number): void {
        if (this._state != TransportState.Opened) {
            throw new Error('transport not opened');
        }
        this._state = TransportState.Ready;
        if (!this._onInit) {
            console.log('No _onInit handler...');
        } else {
            this._onInit();
        }
    }

    protected _state: TransportState = TransportState.Initializing;

    lastMessageId: string = null;

    waitForInit(timeout: Promise<any>): Promise<any> {
        if (this._state === TransportState.Ready) {
            return Promise.resolve(true);
        }

        if (this._state < TransportState.Ready) {

            return new Promise((resolve, reject) => {
                let initialized = false;

                timeout.then(() => {
                    if (initialized) {
                        return;
                    }
                    delete this._onInit;
                    console.warn('waitForInit: timeout');
                    reject(new Error(`Timout: Could not initialize transport within ${timeout}ms.`));
                    this.close();
                });

                this._onInit = () => {
                    console.log('waitForInit: transport initialized.')
                    initialized = true;
                    resolve();
                    delete this._onInit;
                };
            });
        }

        return Promise.reject(new Error('Transport closed before init was received.'));
    }

    connect(cancelTimeout: Promise<void>, reconnect: boolean = false): Promise<void> {
        console.log(`Connecting ${this.name} transport.`);

        if (this._socket !== null) {
            return Promise.reject(new Error("A socket is already set to the instance of this transport."));
        }

        return new Promise<void>((resolve: () => void, reject: (e: any) => void) => {
            let socket = this.connectSocket(reconnect);
            let opened = false;


            cancelTimeout.then((error) => {
                if (opened) {
                    return;
                }

                console.warn('(Re)connect timed out.', reconnect);
                socket.close();
                this._socket = null;
                reject(new Error('Connect Timeout.'));
            });

            socket.onopen = () => {
                this._state = TransportState.Opened;
                opened = true;
                resolve();
            };

            socket.onerror = (ev: Error | ErrorEvent) => {
                if (ev instanceof Error) {
                    this._sink.transportError(ev);
                } else if (ev instanceof ErrorEvent) {
                    let error = new Error(`Poll Socket Error: ${ev.message}.`);
                    this._sink.transportError(error);
                }
            };

            socket.onclose = (ev: CloseEvent) => {
                this._state = TransportState.Closed;

                console.debug('Socket onclose');

                if (!opened) {
                    reject(new Error(`Connection closed before really opened (wasClean: ${ev.wasClean}; code: ${ev.code}; reason: ${ev.reason}).`));
                }

                let cleanClose = opened === false || typeof (ev.wasClean) === "undefined" || ev.wasClean === true;

                if (!cleanClose) {
                    let errorMessage = "Unclean disconnect from socket: " + (ev.reason || "[no reason given].");
                    console.warn(errorMessage, ev);
                    this._sink.transportError(new Error(errorMessage));
                }

                if (typeof this._onClose === "function") {
                    //called from close();
                    this._onClose(cleanClose);
                } else {
                    //reconnect?
                    if (this.connectionLost) {
                        this.connectionLost(this);
                    }
                }
            };

            socket.onmessage = (ev: MessageEvent): void => {
                let messageData = <RawMessageData>ev.data;
                if (typeof messageData === 'string') {
                    messageData = JSON.parse(ev.data);
                }
                console.log('onmessage', messageData);

                this._sink.handleMessage(this, messageData);
            };

            this._socket = socket;
        });
    }

    close(): Promise<boolean> {
        console.log('close called on transport');

        if (this._onClose !== null && this._onClose !== undefined) {
            console.warn('close called twice.');
        }

        if (this._socket == null) {
            console.log('No Socket created.');
            return Promise.resolve(true);
        }

        if (this._socket.readyState === SocketState.CLOSED) {
            console.log('Socket already closed.');
            this._socket = null;

            if (typeof this._onClose === "function") {
                //should never happen.
                console.warn('Possible unresolved _onClose promise.')
            }

            return Promise.resolve(false);
        }

        return new Promise((resolve: (cleanClose: boolean) => void) => {
            this._onClose = (cleanClose: boolean) => {
                delete this._onClose;
                this._socket = null;
                resolve(cleanClose);
            };

            this._socket.close();
        });

    }

}
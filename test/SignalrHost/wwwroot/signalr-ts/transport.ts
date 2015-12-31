///<reference path="./_wire.d.ts" />
import {Connection}  from './connection';
import {getLogger} from './logging';
import {UrlBuilder} from './url';



export class MessageSink {

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
    send(data: any): void | Promise<any>;
}

export type Transformer = (data: any) => any;

export interface TransportConfiguration {
    name: string;

    connectSocket(url: UrlBuilder, reconnect: boolean, transport: Transport): SocketAlike;

    createSendTransformer(): Transformer;
}


export interface InitEvent {
    correlationId?: number;
}

export class Transport {
    private _onInit: () => void;
    protected _socket: SocketAlike = null;
    private _onClose: (cleanClose: boolean) => void;

    public oninit: (ev: InitEvent) => void;

    private _beforeSend: (data: any) => any;
    private _sink: MessageSink;

    constructor(private transportConfiguration: TransportConfiguration, private connection: Connection) {
        this._beforeSend = transportConfiguration.createSendTransformer();
        this.protocol = transportConfiguration.name;
        this._sink = connection.messageSink;
    }


    protocol: string;

    connectionLost: (transport: this) => void;

    public send(data: any): Promise<any> {
        var payload = this._beforeSend(data);

        let result = this._socket.send(payload);

        return Promise.resolve(result);
    }

    private connectSocket(reconnect: boolean): SocketAlike {
        return this.transportConfiguration.connectSocket(this.connection.url, reconnect, this);
    }

    get supportsKeepAlive(): boolean {
        return false;
    }

    setInitialized(correlationId: number): void {
        if (this._state != TransportState.Opened) {
            throw new Error('transport not opened');
        }
        this._state = TransportState.Ready;
        if (!this.oninit) {
            console.log('No oninit handler...');
        } else {
            this.oninit({ correlationId });
        }
    }

    protected _state: TransportState = TransportState.Initializing;

    get state(): TransportState {
        return this._state;
    }

    lastMessageId: string = null;


    connect(cancelTimeout: Promise<number>, reconnect: boolean = false): Promise<void> {
        console.log(`Connecting ${this.protocol} transport.`);

        if (this._socket !== null) {
            return Promise.reject(new Error("A socket is already set to the instance of this transport."));
        }

        return new Promise<void>((resolve: () => void, reject: (e: any) => void) => {
            let socket = this.connectSocket(reconnect);
            let opened = false;


            cancelTimeout.then((timeout) => {
                if (opened) {
                    return;
                }

                console.warn('(Re)connect timed out.', reconnect);
                socket.close();
                this._socket = null;
                reject(new Error(`Timeout: Could not connect transport within ${timeout}ms.`));
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
            if (this._state !== TransportState.Closed) {
                this._state = TransportState.Closed;
            }
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
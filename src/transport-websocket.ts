import {Transport, MessageSink, TransportState} from './transport';
import {Deferred} from './deferred';

export class WebSocketTransport implements Transport {

    private _socket: WebSocket = null;
    private _sink: MessageSink;

    private _state: TransportState = TransportState.Initializing;

    private _closeDeferred: Deferred<boolean> = null;
    private _startDeferred: Deferred<void> = new Deferred<void>();

    private _initDeferred: Deferred<void> = new Deferred<any>();

    constructor(private connectUrl: string, sink: MessageSink) {
        this._sink = sink;
    }

    waitForInit(timeout: number): Promise<any> {
        if (this._state < TransportState.Ready) {

            return new Promise((resolve, reject) => {
                let rejectTimeout = setTimeout(() =>
                    reject(new Error(`Timout: Could not initialize transport within ${timeout}ms.`)),
                    timeout);
                this.onInit.then(() => { clearTimeout(rejectTimeout); resolve() });
            });

            return this._initDeferred.promise;
        }
        if (this._state === TransportState.Ready) {
            return Promise.resolve(true);
        }
        return Promise.reject(new Error('Transport already closed'));
    }

    setInitialized(correlationId: number): void {
        if (this._state != TransportState.Opened) {
            throw new Error('transport not opened');
        }
        this._state = TransportState.Ready;
        this._initDeferred.resolve();
    }

    static get name(): string {
        return "webSockets";
    }
    get name(): string {
        return "webSockets";
    }

    get onClose(): Promise<boolean> {
        if (this._closeDeferred === null) {
            this._closeDeferred = new Deferred<boolean>()
        }
        return this._closeDeferred.promise;
    }

    get onConnect(): Promise<void> {
        return this._startDeferred.promise;
    }

    get onInit(): Promise<void> {
        return this._initDeferred.promise;
    }

    get supportsKeepAlive(): boolean {
        return true;
    }

    send(data: any): Promise<any> {

        let payload = typeof (data) === "string" ? data : JSON.stringify(data);

        this._socket.send(payload);
        return Promise.resolve(null);
    }

    close(): Promise<boolean> {

        console.log('close called on transport');
        this._socket.close();

        return this.onClose;
    }

    connect(): Promise<void> {
        console.log('connect transport');
        if (this._socket !== null) {
            throw new Error("A socket is already set to the instance of this transport.");
        }

        let socket = new WebSocket(this.connectUrl);

        socket.onopen = () => {
            this._state = TransportState.Opened;
            this._startDeferred.resolve();
        };

        socket.onerror = (ev: ErrorEvent) => {
            let error = new Error(`WebSocket Error: ${ev.message}.`);
            this._sink.transportError(error);
        };

        socket.onclose = (ev: CloseEvent) => {
            let opened = this._state === TransportState.Opened;
            this._state = TransportState.Closed;

            console.debug('WebSocket onclose');

            if (!opened) {
                this._startDeferred.reject(new Error(`Connection closed before really opened (wasClean: ${ev.wasClean}; code: ${ev.code}; reason: ${ev.reason}).`));
            }

            let cleanClose = opened === false || typeof (ev.wasClean) === "undefined" || ev.wasClean === true;

            if (!cleanClose) {
                let errorMessage = "Unclean disconnect from websocket: " + (ev.reason || "[no reason given].");
                console.warn(errorMessage);
                this._sink.transportError(new Error(errorMessage));
            }

            if (this._closeDeferred !== null) {
                this._closeDeferred.resolve(cleanClose);
            }
        };

        socket.onmessage = (ev: MessageEvent): void => {
            this._sink.handleMessage(this, ev.data);
        }

        this._socket = socket;

        return this.onConnect;
    }
}
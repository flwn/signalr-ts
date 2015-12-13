import {Transport, MessageSink, TransportState} from './transport';
import {UrlBuilder} from './url';

export class WebSocketTransport extends Transport {

    private _socket: WebSocket = null;
    private _sink: MessageSink;


    private _onClose: (cleanClose: boolean) => void;


    constructor(private url: UrlBuilder, sink: MessageSink) {
        super();
        this._sink = sink;
    }

    static get name(): string {
        return "webSockets";
    }
    get name(): string {
        return "webSockets";
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

        if (this._onClose !== null && this._onClose !== undefined) {
            console.warn('close called twice.');
        }

        return new Promise((resolve: (cleanClose: boolean) => void) => {
            this._onClose = (cleanClose: boolean) => {
                delete this._onClose;
                resolve(cleanClose);
            };

            this._socket.close();
        });
    }

    connect(): Promise<void> {
        console.log('connect transport');
        if (this._socket !== null) {
            throw new Error("A socket is already set to the instance of this transport.");
        }

        return new Promise<void>((resolve: () => void, reject: (error: Error) => void) => {
            let socket = new WebSocket(this.url.connect());


            socket.onopen = () => {
                this._state = TransportState.Opened;
                resolve();
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
                    reject(new Error(`Connection closed before really opened (wasClean: ${ev.wasClean}; code: ${ev.code}; reason: ${ev.reason}).`));
                }

                let cleanClose = opened === false || typeof (ev.wasClean) === "undefined" || ev.wasClean === true;

                if (!cleanClose) {
                    let errorMessage = "Unclean disconnect from websocket: " + (ev.reason || "[no reason given].");
                    console.warn(errorMessage);
                    this._sink.transportError(new Error(errorMessage));
                }

                if (typeof this._onClose === "function") {
                    this._onClose(cleanClose);
                }
            };

            socket.onmessage = (ev: MessageEvent): void => {
                this._sink.handleMessage(this, JSON.parse(ev.data));
            }

            this._socket = socket;
        });
    }
}
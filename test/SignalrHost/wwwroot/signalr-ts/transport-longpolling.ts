///<reference path="../typings/tsd.d.ts" />
///<reference path="./_wire.d.ts" />

import {Transport, MessageSink, TransportState} from './transport';
import {UrlBuilder} from './url';
import 'fetch';

interface MessageEvent {
    data: RawMessageData;
}
interface ErrorEvent {
    message: string;
}
interface CloseEvent {
    code: number;
    reason: string;
    wasClean: boolean;
}
enum SocketState {
    Opened, Closed
}

class PollSocket {

    constructor(private url: UrlBuilder, private transport: LongPollingTransport) {
    }

    readyState: SocketState;

    private poll(): Promise<PersistentConnectionData> {
        console.log('polling...');
        
        var url = this.url.poll(this.lastMessageId);
        if (this.readyState !== SocketState.Opened) {
        console.log('socket closed.');
            return Promise.reject(new Error('socket closed.'));
        }

        let promise = fetch(url)
            .then(r => r.json<PersistentConnectionData>());

        promise.then((r) => {
            console.log('poll result',r);
            this.lastMessageId = r.C;
            this.onmessage({data: r});
            this.poll();
        });

        return promise;
    }

    connect() {
        let connectUrl = this.url.connect();
        return fetch(connectUrl)
            .then((response: Response) => {
                return response.json<RawMessageData>();
            })
            .then((responseBody: RawMessageData) => {
                this.readyState = SocketState.Opened;

                this.onmessage({ data: responseBody });
                if (typeof (responseBody.S) !== "number") {
                    throw new Error('Expected S property on server response.');
                }
            })
            .then(() => {
                this.poll();
            });
    }

    start() {

    }

    stop() {

    }

    send(data: any) {
        var url = this.url.send();

        var body = null;
        if (typeof (data) === "string" || typeof data === "undefined" || data === null) {
            body = data;
        } else {
            body = JSON.stringify(data);
        }
var formdata = new FormData();
formdata.append('data', body);
        return fetch(url, { method: 'POST',
  headers: {
    //'Accept': 'application/json',
    //'Content-Type': 'application/json'
  }, body: formdata })
            .then((response: Response) => response.json<RawMessageData>())
            .then(response => this.onmessage({ data: response }));
    }

    lastMessageId: string;

    onclose: (ev: CloseEvent) => void;

    onmessage: (message: MessageEvent) => void;
    onerror: (error: ErrorEvent) => void;
}

export class LongPollingTransport extends Transport {

    private _sink: MessageSink;
    private _lastId: string;

    private _socket: PollSocket;

    constructor(private url: UrlBuilder, sink: MessageSink) {
        super();
        this._sink = sink;
    }


    static get name(): string {
        return "longPolling";
    }
    get name(): string {
        return "longPolling";
    }

    get supportsKeepAlive(): boolean {
        return false;
    }


    send(data: any): Promise<void> {
        if (this._state !== TransportState.Ready) {
            throw new Error('Transport is not ready for sending.');
        }

        let payload = typeof (data) === "string" ? data : JSON.stringify(data);
        return this._socket.send(payload);
    }

    close(): Promise<boolean> {

        console.log('close called on transport');

        this._socket.stop();
        return Promise.resolve(true);
    }

    connect(): Promise<void> {

        return new Promise<void>((resolve: () => void, reject: (e: any) => void) => {
            let pollSocket = new PollSocket(this.url, this);

            pollSocket.onerror = (ev: ErrorEvent) => {
                let error = new Error(`Poll Socket Error: ${ev.message}.`);
                this._sink.transportError(error);
            };

            pollSocket.onclose = (ev: CloseEvent) => {

            };

            pollSocket.onmessage = (ev: MessageEvent): void => {
                console.log('onmessage', ev.data);
                
                    this._sink.handleMessage(this, ev.data);
            };
            
            this._state = TransportState.Opened;

            pollSocket.connect()
                .then(() => {
                    //this._state = TransportState.Ready;
                    resolve();
                });

            this._socket = pollSocket;
        });
    }
}
///<reference path="../typings/tsd.d.ts" />
///<reference path="./_wire.d.ts" />

import {Transport, MessageSink, TransportState, SocketAlike} from './transport';
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
    Opening, Opened, Closed
}
function noop() { }

class PollSocket implements SocketAlike {

    constructor(private url: UrlBuilder) {
        this.connect();
    }

    readyState: SocketState = SocketState.Opening;

    private poll(): Promise<PersistentConnectionData> {
        console.log('polling...');

        var url = this.url.poll(this.lastMessageId);
        if (this.readyState !== SocketState.Opened) {
            console.log('socket closed.');
            return Promise.reject(new Error('socket closed.'));
        }

        let promise = fetch(url)
            .then(r => r.json<PersistentConnectionData>());

        promise.catch((e: Error) => {
            this.onerror(e);
            this._close(false);
        });

        promise.then((r) => {
            console.log('poll result', r);
            this.lastMessageId = r.C;
            this.onmessage({ data: r });
            this.poll();
        });

        return promise;
    }

    private connect() {
        let connectUrl = this.url.connect();

        let promise = fetch(connectUrl)
            .then((response: Response) => {
                return response.json<RawMessageData>();
            });

        promise.then((responseBody: RawMessageData) => {
                if(this.readyState !== SocketState.Opening) {
                    console.log('Connect failed. ReadyState is not Opening but is: ' + this.readyState);
                    return;
                }
            
                this.readyState = SocketState.Opened;
                this.onopen(new Event("OpenEvent"));

                this.onmessage({ data: responseBody });
                if (typeof (responseBody.S) !== "number") {
                    throw new Error('Expected S property on server response.');
                }
                this.poll();
            });

        return promise;
    }
    private _close(wasClean: boolean, code?: number, reason?: string) {
        this.readyState = SocketState.Closed;
        if (typeof this.onclose === "function") {
            this.onclose({ wasClean, code, reason });
        }
    }
    
    close(code?: number, reason?: string) {
        this._close(true, code, reason);
    }

    send(data: any) {
        if(this.readyState !== SocketState.Opened) {
            return Promise.reject(new Error('Invalid State'));
        }
        
        let url = this.url.send();

        let body = null;
        if (typeof (data) === "string" || typeof data === "undefined" || data === null) {
            body = data;
        } else {
            body = JSON.stringify(data);
        }

        let formdata = new FormData();
        formdata.append('data', body);

        return fetch(url, { method: 'POST', body: formdata })
            .then((response: Response) => response.json<RawMessageData>())
            .then(response => this.onmessage({ data: response }));
    }

    lastMessageId: string;

    onopen: (ev: Event) => void;
    onclose: (ev: CloseEvent) => void;

    onmessage: (message: MessageEvent) => void;
    onerror: (error: any) => void;
}

export class LongPollingTransport extends Transport {

    private _lastId: string;

    constructor(private url: UrlBuilder, sink: MessageSink) {
        super(sink);
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

    createSocket() : SocketAlike {
        return new PollSocket(this.url);
    }
    
    send(data: any): Promise<void> {
        if (this._state !== TransportState.Ready) {
            throw new Error('Transport is not ready for sending.');
        }

        let payload = typeof (data) === "string" ? data : JSON.stringify(data);
        return (<PollSocket>this._socket).send(payload);
    }

}
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

    constructor(private url: UrlBuilder, lastMessageId: string) {
        this._lastMessageId = lastMessageId;
    }

    readyState: SocketState = SocketState.Opening;

    onopen: (ev: Event) => void;
    onclose: (ev: CloseEvent) => void;
    onmessage: (message: MessageEvent) => void;
    onerror: (error: any) => void;

    private _lastMessageId: string;
    private _pollTimeout: number;
    private _reconnectTimeout: number;

    private handlePollResponse(responseBody: RawMessageData) {

        this._lastMessageId = responseBody.C;
        
        this.onmessage({ data: responseBody });

        if (typeof responseBody.L === "number") {
            //Long Poll Delay is set 
            this._pollTimeout = setTimeout(() => this.poll(), responseBody.L);
        } else {
            this.poll();
        }
    }

    private poll(): Promise<PersistentConnectionData> {
        console.log('polling...');

        var url = this.url.poll(this._lastMessageId);
        if (this.readyState !== SocketState.Opened) {
            console.log('socket closed.');
            return Promise.reject(new Error('socket closed.'));
        }

        let promise = fetch(url)
            .then(r => r.json<RawMessageData>());

        promise.catch((e: Error) => {
            this.onerror(e);
            this._close(false);
        });

        promise.then((r) => {
            console.log('poll result', r);
            this.handlePollResponse(r);
        });

        return promise;
    }

    public connect(reconnectCount: number) {
        let isReconnecting = reconnectCount > 0;
        let connectUrl = this.url.connect(isReconnecting);
        console.log('Polling. Connecting to ' + connectUrl);

        var formdata = new FormData();
        formdata.append('transport', this.url.transport);
        formdata.append('clientProtocol', '1.5');
        formdata.append('connectionToken', this.url.connectionToken);
        formdata.append('connectionData', decodeURIComponent(this.url.connectionData));
        if (this._lastMessageId) {
            formdata.append('messageId', this._lastMessageId);
        }


        var options = isReconnecting ? { method: 'POST', body: formdata } : undefined;
        let promise = fetch(connectUrl, options)
            .then((response: Response) => {
                return response.json<RawMessageData>();
            });

        promise.then((responseBody: RawMessageData) => {

            if (!isReconnecting) {
                if (this.readyState !== SocketState.Opening) {
                    console.log('Connect failed. ReadyState is not Opening but is: ' + this.readyState);
                    return;
                }

                this.fireOpened();

                if (typeof (responseBody.S) !== "number") {
                    //it is possible to receive messages before init request is received.
                    console.warn('Expected S property on first server response.');
                }
            }

            this.handlePollResponse(responseBody);
        });


        clearTimeout(this._reconnectTimeout);

        if (isReconnecting) {
            //long polling will change state from reconnecting to connecting before the connect request returns.
            //some heuristic is in place to increase the delay for reconnected events when the requests repeately fails.
            let reconnectHeuristic = Math.min(1000 * (2 ** reconnectCount - 1), 1000 * 60 * 60);
            this._reconnectTimeout = setTimeout(() => this.fireOpened(), reconnectHeuristic);
        }
        
        promise.catch(e => {
            console.warn('error while connecting longPolling', e);
            this._close(false);
        });

        return promise;
    }

    fireOpened() {
        this.readyState = SocketState.Opened;
        clearTimeout(this._reconnectTimeout);
        this.onopen(new Event("OpenEvent"));
    }

    private _close(wasClean: boolean, code?: number, reason?: string) {
        this.readyState = SocketState.Closed;

        clearTimeout(this._pollTimeout);
        delete this._pollTimeout;
        clearTimeout(this._reconnectTimeout);
        delete this._reconnectTimeout;

        if (typeof this.onclose === "function") {
            this.onclose({ wasClean, code, reason });
        }
    }

    close(code?: number, reason?: string) {
        this._close(true, code, reason);
    }

    send(data: any) {
        if (this.readyState !== SocketState.Opened) {
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
}

export class LongPollingTransport extends Transport {

    private _reconnectCount = 0;

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


    connectSocket(isReconnecting: boolean): SocketAlike {
        let socket = new PollSocket(this.url, this.lastMessageId);

        if (isReconnecting) {
            this._reconnectCount++;
            console.log(`Reconnecting longPolling socket. Reconnect count: ${this._reconnectCount}.`);
        }

        socket.connect(this._reconnectCount)
            .then(() => {
                this._reconnectCount = 0;
            });

        return socket;
    }

    send(data: any): Promise<void> {
        if (this._state !== TransportState.Ready) {
            throw new Error('Transport is not ready for sending.');
        }

        let payload = typeof (data) === "string" ? data : JSON.stringify(data);
        return (<PollSocket>this._socket).send(payload);
    }

}
///<reference path="./_wire.d.ts" />
import {Transport, SocketAlike, TransportConfiguration, Transformer} from './transport';
import {UrlBuilder} from './url';
import {Configuration} from './config';
import {FetchHttpClient} from './http';

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


function createEvent(name: string) {
    try {
        return new Event(name);
    } catch (e) {
        // Internet Explorer doesn't support the Event constructor.
        // Simple try catch because this is not in our hot path.
        let event = document.createEvent('Event');
        event.initEvent(name, false, false);
        return event;
    }
}

class PollSocket implements SocketAlike {

    constructor(private url: UrlBuilder, lastMessageId: string, private http: FetchHttpClient) {
        this._lastMessageId = lastMessageId;
    }

    readyState: SocketState = SocketState.Opening;

    onopen: (ev: Event) => void = null;
    onclose: (ev: CloseEvent) => void = null;
    onmessage: (message: MessageEvent) => void = null;
    onerror: (error: any) => void = null;

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
            console.log('socket closed.', this.readyState);
            return Promise.reject<PersistentConnectionData>(new Error('socket closed.'));
        }

        let promise = this.http.get<RawMessageData>(url);

        promise.catch((e: Error) => {
            console.error("--->> poll error!", arguments)
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

        let promise = (isReconnecting ?
            this.http.post<RawMessageData>(connectUrl, formdata) :
            this.http.get<RawMessageData>(connectUrl));


        promise.then((responseBody: RawMessageData) => {

            if (!isReconnecting) {
                if (this.readyState !== SocketState.Opening) {
                    console.log('Connect failed. ReadyState is not Opening but is: ' + this.readyState);
                    return;
                }

                if (typeof (responseBody.S) !== "number") {
                    //it is possible to receive messages before init request is received.
                    console.warn('Expected S property on first server response.');
                }
            }

            if (!isReconnecting || this.readyState !== SocketState.Opened) {
                //the _reconnectTimeout could fire before this request is handled.
                this.fireOpened();
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
        this.onopen(createEvent("OpenEvent"));
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

        return this.http.post<RawMessageData>(url, formdata)
            .then(response => this.onmessage({ data: response }));
    }
}

function transformSend(data: any): any {
    let payload = typeof (data) === "string" ? data : JSON.stringify(data);

    return payload;
}

const reconnectCounter = '__reconnectCount';

export default class longPolling implements TransportConfiguration {
    name = longPolling.name;
    static name = "longPolling";

    constructor(private configuration: Configuration) {

    }


    connectSocket(uri: UrlBuilder, reconnect: boolean, transport: Transport): SocketAlike {
        let socket = new PollSocket(uri, transport.lastMessageId, this.configuration.http);
        let reconnectCount = transport[reconnectCounter];
        if (typeof reconnectCount !== 'number') {
            transport[reconnectCounter] = reconnectCount = 0;
        }

        if (reconnect) {
            transport[reconnectCounter] = ++reconnectCount;
            console.log(`Reconnecting longPolling socket. Reconnect count: ${reconnectCount}.`);
        }

        socket.connect(reconnectCount)
            .then(() => {
                transport[reconnectCounter] = 0;
            });

        return socket;
    }

    createSendTransformer(): Transformer {
        return <Transformer>(x) => x;
    }
}

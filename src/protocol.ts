///<reference path="./_wire.d.ts" />

import {Connection} from './connection';
import {Transport, MessageSink} from './transport';
import {LongPollingTransport} from './transport-longpolling';
import {WebSocketTransport} from './transport-websocket';
import {ConnectionConfig} from './config';
import {UrlBuilder} from './url';
import 'fetch';

interface TransportConstructor {
    new (url: UrlBuilder, messageSink: MessageSink): Transport;
    name: string;
}

var defaultTransportOrder = [WebSocketTransport, LongPollingTransport];

var transportLookup: { [key: string]: TransportConstructor } = {
    'websockets': WebSocketTransport,
    'longpolling': LongPollingTransport
};

function createTransportOrderList(configuredTransport?: string | string[]): TransportConstructor[] {

    if (typeof configuredTransport === 'string') {
        let transportName = configuredTransport.toLowerCase();

        if (transportLookup.hasOwnProperty(transportName)) {
            return [transportLookup[transportName]];
        }

    } else if (Array.isArray(configuredTransport)) {
        let transportOrder: TransportConstructor[] = [];

        for (let i = 0; i < configuredTransport.length; i++) {
            let transportName = configuredTransport[i].toLowerCase();
            if (transportLookup.hasOwnProperty(transportName)) {
                transportOrder.push(transportLookup[transportName]);
            }
        }
        return transportOrder;
    }

    return defaultTransportOrder;
}

function buildTransport(transportConstructor: TransportConstructor, connection: Connection): Transport {
    let url = connection.url;
    let messageSink = connection.messageSink;
    url.transport = transportConstructor.name;

    let instance: Transport = new transportConstructor(url, messageSink);

    return instance;
}

function tryWithinTime<T>(promise: Promise<T>, timeout: number): Promise<T> {
    return new Promise((resolve: (r: T) => void, reject: (e: Error) => void) => {
        var timer = setTimeout(() => {
            console.warn('tryConnect: timeout');
            reject(new Error(`Timout: Could not initialize transport within ${timeout}ms.`));
        }, timeout);

        promise.then((r: T) => {
            clearTimeout(timer);
            resolve(r);
        });
    });
}

function createTimeout(timeout: number): Promise<void> {
    return new Promise<void>((resolve: () => void, reject: (e: Error) => void) => {
        var timer = setTimeout(() => { resolve(); }, timeout);
    });
}


function tryConnect(nextTransportInLine: () => Transport, timeout: number): Promise<Transport> {
    let transport: Transport = nextTransportInLine();

    if (transport === null) {
        return Promise.reject(new Error('Could not connect to transport.'));
    }
    var timeoutPromise = createTimeout(timeout);
    var connectPromise = transport.connect(timeoutPromise)
        .then(() => transport.waitForInit(timeoutPromise))
        .then(() => transport);

    return tryWithinTime<Transport>(connectPromise, timeout)
        .catch(e => {
            console.warn(`Failed to connect using ${transport.name} transport.`, e);
            return tryConnect(nextTransportInLine, timeout);
        });
}

function connectToFirstAvailable(transportOrder: TransportConstructor[], connection: Connection, timeout: number): Promise<Transport> {

    return tryConnect(() => {
        if (transportOrder.length === 0) {
            return null;
        }
        return buildTransport(transportOrder.shift(), connection);
    }, timeout);
}

export class ProtocolHelper {

    public negotiate(connection: Connection): Promise<NegotiationResult> {
        let url = connection.url;
        var negotiateUrl = url.negotiate();

        return fetch(negotiateUrl)
            .then(response => response.json<NegotiationResult>())
            .then((negotiationResult: NegotiationResult) => {
                url.connectionId = negotiationResult.ConnectionId;
                url.connectionToken = negotiationResult.ConnectionToken;
                url.appRelativeUrl = negotiationResult.Url;

                return negotiationResult;
            });

    }

    public reconnect(connection: Connection) {
        let disconnectTimeout = connection.timeouts.disconnectTimeout * 1000;
        console.log(`reconnecting (Timeout is ${String(disconnectTimeout)}ms).`);
        let reconnectTimeout = createTimeout(disconnectTimeout);

        return connection.transport.close()
            .then(() => connection.transport.connect(reconnectTimeout , true));
    }

    public connect(connection: Connection, negotiationResult: NegotiationResult, options: ConnectionConfig = {}): Promise<Transport> {
        let url = connection.url;

        let transportInitialized = false;
        let messageSink = connection.messageSink;
        let timeout = negotiationResult.TransportConnectTimeout * 1000;

        let transports: TransportConstructor[] = createTransportOrderList(options.transport);

        if (false === negotiationResult.TryWebSockets) {
            let websocketsIndex = transports.indexOf(WebSocketTransport);
            if (websocketsIndex >= 0) {
                transports.splice(websocketsIndex, 1);
            }
        }

        if (transports.length < 1) {
            return Promise.reject(new Error(`No transport configured. Supported transports: ${Object.keys(transportLookup)} (Server supports WebSockets: ${negotiationResult.TryWebSockets}).`));
        }

        return connectToFirstAvailable(transports, connection, timeout);
    }

    public start(connection: Connection): Promise<any> {
        let startUrl = connection.url.start();

        return fetch(startUrl)
            .then(response => response.json<StartResponse>())
            .then((response: StartResponse): void => {
                if (typeof (response) !== "object" || response === null || response.Response !== "started") {
                    throw new Error('Start not succeeded');
                }
                console.log('start success');
            });
    }

    public abort(connection: Connection): Promise<any> {
        let abortUrl = connection.url.abort();

        connection.transport.close();

        return fetch(abortUrl, { method: 'POST', body: '' });
    }
}

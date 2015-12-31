///<reference path="./_wire.d.ts" />

import {Connection} from './connection';
import {Transport, TransportState, InitEvent} from './transport';
import {ConnectionConfig, getTransportConfiguration} from './config';


function buildTransport(transport: string, connection: Connection): Transport {
    let transportFactory = getTransportConfiguration(transport, connection.config);
    let url = connection.url;
    let messageSink = connection.messageSink;
    url.transport = transportFactory.name;

    let instance: Transport = new Transport(transportFactory, connection);


    return instance;
}

function tryWithinTime<T>(promise: Promise<T>, timeout: number): Promise<T> {
    return new Promise((resolve: (r: T) => void, reject: (e: Error) => void) => {
        var timer = setTimeout(() => {
            console.warn('tryConnect: timeout');
            reject(new Error(`Timeout: Could not initialize transport within ${timeout}ms.`));
        }, timeout);

        promise.then((r: T) => {
            clearTimeout(timer);
            resolve(r);
        });
    });
}

function createTimeout(timeout: number): Promise<number> {
    return new Promise<number>((resolve: (result: number) => void, reject: (e: Error) => void) => {
        var timer = setTimeout(() => { resolve(timeout); }, timeout);
    });
}


function tryConnect(nextTransportInLine: () => Transport, timeout: number): Promise<Transport> {
    let transport: Transport = nextTransportInLine();

    if (transport === null) {
        return Promise.reject<Transport>(new Error('Could not connect to transport.'));
    }
    var timeoutPromise = createTimeout(timeout);
    var connectPromise = transport.connect(timeoutPromise)
        .then(() => waitForInitializedTransport(transport, timeoutPromise))
        .then(() => transport);

    return tryWithinTime<Transport>(connectPromise, timeout)
        .catch(e => {
            console.warn(`Failed to connect using ${transport.protocol} transport.`, e);
            return tryConnect(nextTransportInLine, timeout);
        });
}

function connectToFirstAvailable(transportOrder: string[], connection: Connection, timeout: number): Promise<Transport> {

    return tryConnect(() => {
        if (transportOrder.length === 0) {
            return null;
        }
        return buildTransport(transportOrder.shift(), connection);
    }, timeout);
}


function waitForInitializedTransport(transport: Transport, timeoutPromise: Promise<number>): Promise<any> {
    if (transport.state === TransportState.Ready) {
        return Promise.resolve(true);
    }

    if (transport.state < TransportState.Ready) {

        return new Promise((resolve, reject) => {
            let initialized = false;

            let oninit = transport.oninit = ev => handleInitEvent(ev);

            timeoutPromise.then((timeout) => {
                if (initialized) {
                    return;
                }
                console.warn('waitForInit: timeout');
                handleInitEvent(new Error(`Timout: Could not initialize transport within ${timeout}ms.`));
            });

            function handleInitEvent(ev: Error | InitEvent) {
                if (initialized) {
                    return;
                }

                initialized = true;

                if (transport.oninit === oninit) {
                    delete transport.oninit;
                }

                if ((<InitEvent>ev).correlationId) {
                    resolve();
                } else {
                    reject(ev);
                    transport.close();
                }
            }
        });
    }

    return Promise.reject(new Error('Transport closed before init was received.'));
}

export class ProtocolHelper {

    public negotiate(connection: Connection): Promise<NegotiationResult> {
        let url = connection.url;
        let negotiateUrl = url.negotiate();
        let http = connection.config.http;



        return http.get<NegotiationResult>(negotiateUrl)
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
            .then(() => connection.transport.connect(reconnectTimeout, true));
    }

    public connect(connection: Connection, negotiationResult: NegotiationResult, options: ConnectionConfig = {}): Promise<Transport> {
        let url = connection.url;

        let transportInitialized = false;
        let messageSink = connection.messageSink;
        let timeout = negotiationResult.TransportConnectTimeout * 1000;

        let transports: string[] = connection.config.transportOrder.slice();

        if (false === negotiationResult.TryWebSockets) {
            let websocketsIndex = transports.indexOf('websockets');
            if (websocketsIndex >= 0) {
                transports.splice(websocketsIndex, 1);
            }
        }

        if (transports.length < 1) {
            return Promise.reject<Transport>(new Error(`No transport configured. Supported transports: ${Object.keys(null)} (Server supports WebSockets: ${negotiationResult.TryWebSockets}).`));
        }

        return connectToFirstAvailable(transports, connection, timeout);
    }

    public start(connection: Connection): Promise<any> {
        let startUrl = connection.url.start();
        let http = connection.config.http;

        return http.get<StartResponse>(startUrl)
            .then((response: StartResponse): void => {
                if (typeof (response) !== "object" || response === null || response.Response !== "started") {
                    throw new Error('Start not succeeded');
                }
                console.log('start success');
            });
    }

    public abort(connection: Connection): Promise<any> {
        let abortUrl = connection.url.abort();
        let http = connection.config.http;

        connection.transport.close();

        return http.post(abortUrl, null);
    }
}

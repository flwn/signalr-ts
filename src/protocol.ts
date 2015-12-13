///<reference path="./_wire.d.ts" />

import {Connection} from './connection';
import {Transport} from './transport';
import {LongPollingTransport} from './transport-longpolling';
import {WebSocketTransport} from './transport-websocket';
import 'fetch';

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

    public connect(connection: Connection, negotiationResult: NegotiationResult): Promise<Transport> {
        let url = connection.url;

        let transportInitialized = false;
        let messageSink = connection.messageSink;
        let timeout = negotiationResult.TransportConnectTimeout * 1000;
        
        let x: typeof Transport = LongPollingTransport;
        
        new x
        
        let transport: Transport = new LongPollingTransport(url, messageSink);
        //let transport: Transport = new WebSocketTransport(url, messageSink);
        url.transport = transport.name;

        return new Promise((resolve: (value: Transport) => void, reject: (reason: any) => void) => {
            transport.connect()
                .then(() => transport.waitForInit(timeout))
                .then(() => {
                    resolve(transport);
                })
                .catch(reject);

        });
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

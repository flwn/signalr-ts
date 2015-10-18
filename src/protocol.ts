///<reference path="./_wire.d.ts" />
import {HttpClient, HttpResponseMessage} from 'aurelia-http-client';

import {Connection} from './connection';
import {Transport} from './transport';
import {WebSocketTransport} from './transport-websocket';


export class ProtocolHelper {
    constructor(private http: HttpClient) { }

    public negotiate(connection: Connection): Promise<NegotiationResult> {

        return new Promise((resolve, reject) => {

            var negotiateUrl = connection.url.negotiate();

            this.http
                .get(negotiateUrl)
                .then(response => resolve(<NegotiationResult> response.content), reject);
        });
    }

    public connect(connection: Connection, negotiationResult: NegotiationResult): Promise<Transport> {
        if (negotiationResult.TryWebSockets !== true) {
            throw new Error('Server does not supports web sockets. No available.');
        }
        
        //todo: add other transports...
        let transportName = WebSocketTransport.name;
        
        let connectUrl = connection.url.connect(negotiationResult.ConnectionToken, transportName);
        let transportInitialized = false;
        let messageSink = connection.messageSink;
        let timout = negotiationResult.TransportConnectTimeout * 1000;

        let transport: Transport = new WebSocketTransport(connectUrl, messageSink);


        return new Promise((resolve: (value: Transport) => void, reject: (reason: any) => void) => {
            transport.connect()
                .then(() => transport.waitForInit(timout))
                .then(() => {
                    resolve(transport);
                })
                .catch(reject);

        });
    }

    public start(connection: Connection): Promise<any> {
        let startUrl = connection.url.start(connection.connectionToken, connection.transport.name);

        return this.http
            .get(startUrl)
            .then((x: HttpResponseMessage): void => {
                var response = <StartResponse> x.content;

                if (typeof (response) !== "object" || response === null || response.Response !== "started") {
                    throw new Error('Start not succeeded');
                }
                console.log('start success');
            });
    }

    public abort(connection: Connection): Promise<any> {
        let abortUrl = connection.url.abort(connection.connectionToken, connection.transport.name);

        connection.transport.close();

        return this.http.post(abortUrl, '');
    }
}

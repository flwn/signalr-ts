﻿///<reference path="./_wire.d.ts" />
import {Transport, MessageSink} from './transport';
import {UrlBuilder} from './url';
import {protocol, EventAggregator, ConnectionConfig} from './config';

export type disposer = { dispose: () => void };


export interface Timeouts {
    /**
     * This setting represents the amount of time to wait for a keepalive packet. 
     * If this timeout is expired, the client tries to reconnect until the disconnectTimeout expires.
     */
    keepAliveTimeout: number;
    
    /**
     * This setting represents the amount of time to wait before aborting a reconnect.
     */
    disconnectTimeout: number;
    
    /**
     * This setting represents the amount of time to wait until a transport connection is established.
     */
    transportConnectTimeout: number;
}

export interface StateChangedEvent {
    oldState: ConnectionState;
    newState: ConnectionState;
}


class ConnectionMonitor {

    private warnAfter: number;
    private keepAliveTimeout: number;

    private _heartBeatInterval: number;

    constructor(private connection: Connection) {
    }

    markLastMessage(): void {
    }

    startMonitoring(): void {
        this.keepAliveTimeout = this.connection.timeouts.keepAliveTimeout * 1000;
        let checkInterval = this.keepAliveTimeout / 3;
        this.warnAfter = checkInterval * 2;

        this._heartBeatInterval = setInterval(() => this.checkKeepAlive(), checkInterval);
        console.log(`Start monitoring keepAlive every ${checkInterval}ms.`);
    }

    stopMonitoring(): void {
        clearInterval(this._heartBeatInterval);
        console.info('monitoring stopped');
    }

    checkKeepAlive() {
        console.debug('checkKeepAlive');
        if (this.connection.state !== ConnectionState.connected) {
            return;
        }

        let lastReceived = Date.now() - this.connection.lastMessageReceived.getTime();

        if (lastReceived > this.keepAliveTimeout) {
            console.warn('ConnectionMonitor: connection exceeded keepAlive timeout. Connection probably lost.')
            this.connection.connectionLost();

            return;
        }

        if (lastReceived > this.warnAfter) {
            console.warn('ConnectionMonitor: connection exceeded 2/3th of the keepAlive timeout. Connection probably slow.')
            this.connection.slowConnection = true;
        } else {
            this.connection.slowConnection = false;
        }
    }
}

export enum ConnectionState {
    connecting = 0,
    connected = 1,
    reconnecting = 2,
    disconnected = 4
}

var stateLookup: { [key: number]: string } = {
    [ConnectionState.connecting]: "connecting",
    [ConnectionState.connected]: "connected",
    [ConnectionState.reconnecting]: "reconnecting",
    [ConnectionState.disconnected]: "disconnected",
};

export class Connection {
    private _state: ConnectionState = ConnectionState.connecting;
    private _slowConnection: boolean = false;
    private _transport: Transport;
    private _urlBuilder: UrlBuilder;

    private monitor: ConnectionMonitor = new ConnectionMonitor(this);

    private eventAggregator: EventAggregator = new EventAggregator();
    private _messageSink: MessageSink = new MessageSink(this);

    private _connectionToken: string;
    private _connectionId: string;
    private _connectionSlow: boolean;

    public lastMessageReceived: Date;
    public groupsToken: string = null;

    public timeouts: Timeouts = {
        disconnectTimeout: 0,
        keepAliveTimeout: 0,
        transportConnectTimeout: 0
    };

    constructor(baseUrl: string = '/signalr') {
        this._urlBuilder = new UrlBuilder(baseUrl);
    }

    /** @private */
    public markLastMessage(): void {
        this.lastMessageReceived = new Date();
        this.monitor.markLastMessage();
    }


    public get state(): ConnectionState {
        return this._state;
    }
    public set state(newState: ConnectionState) {
        let oldState = this._state;
        this._state = newState;
        console.log(`State changed from ${stateLookup[oldState]} to ${stateLookup[newState]}.`);
        this.eventAggregator.publish('stateChanged', <StateChangedEvent>{ oldState, newState });
    }

    public get transport(): Transport {
        return this._transport;
    }

    public get connectionToken(): string {
        return this._connectionToken;
    }

    get url(): UrlBuilder {
        return this._urlBuilder;
    }


    get slowConnection(): boolean {
        return this._slowConnection;
    }
    set slowConnection(isSlowConnection: boolean) {
        if (isSlowConnection && this._slowConnection === false) {
            this.eventAggregator.publish('connectionSlow', this);
        }
        this._slowConnection = isSlowConnection;
    }

    /** @private */
    connectionLost(): void {
        this.eventAggregator.publish('connectionLost', this);
        this.handleTransportConnectionLoss(this._transport);
    }


    public get messageSink(): MessageSink {
        return this._messageSink;
    }

    private setNegotiated(result: NegotiationResult): void {
        this._connectionToken = result.ConnectionToken;
        this._connectionId = result.ConnectionId;

        this.timeouts.disconnectTimeout = result.DisconnectTimeout;
        this.timeouts.keepAliveTimeout = result.KeepAliveTimeout;
        this.timeouts.transportConnectTimeout = result.TransportConnectTimeout;
    }

    private handleTransportConnectionLoss(transport: Transport) {
        if (this._transport === transport && this.state === ConnectionState.connected) {
            console.warn('Connection interrupted');
            this.reconnect();
        }
    }

    private reconnect() {
        this.state = ConnectionState.reconnecting;
        protocol.reconnect(this)
            .then(() => {
                this.state = ConnectionState.connected;
            })
            .catch((e: any) => {
                console.warn('Failed to reconnect. Stopping connection.', e);
                this.stop();
            });
    }

    /**
      * Subscribe to incoming messages.
      * @returns a dispose function. Calling this function will dispose the subscription.
      */
    onMessage<T>(handler: (message: T) => void): disposer {
        return this.eventAggregator.subscribe('message', handler);
    }

    /**
      * Subscribe to state changes.
      * @returns a dispose function. Calling this function will dispose the subscription.
     */
    onStateChange(handler: (stateChanged: StateChangedEvent) => void): disposer {
        return this.eventAggregator.subscribe('stateChanged', handler);
    }

    /** Send data to the server.
     * @returns a promise which resolves when the data is send.
     */
    send(data: any): Promise<void> {
        return this._transport.send(data);
    }


    /** This method is used internally by the signalr client for handling incoming data. 
     * @private
    */
    handleData(data: PersistentConnectionData) {

        this.eventAggregator.publish('datareceived', data);

        var shouldReconnect = typeof (data.T) !== "undefined" && data.T === 1;
        if (shouldReconnect) {
            console.log('Server says "You Should reconnect". So we try...');
            this.reconnect();
        }

        if (typeof (data.G) !== "undefined") {
            this.groupsToken = data.G;
        }


        if (Array.isArray(data.M)) {

            data.M.forEach(message =>
                this.eventAggregator.publish('message', message));
        }
    }

    /**
     * Starts the connection.
     * @param {ConnectionConfig} options - Configuration for this connection.
     * @returns a Promise of `this` which resolves when the connection is succesfully started.
     */
    start(options?: ConnectionConfig): Promise<Connection> {

        return protocol.negotiate(this)
            .then((result: NegotiationResult) => {
                this.setNegotiated(result);
                return protocol.connect(this, result, options);
            })
            .then((transport) => {
                if (transport.supportsKeepAlive) {
                    this.monitor.startMonitoring();
                }

                transport.connectionLost = t => this.handleTransportConnectionLoss(t);
                this._transport = transport;

                return protocol.start(this);
            })
            .then(() => {
                this.state = ConnectionState.connected;

                //todo: support node with beforeExit?
                window.addEventListener('unload', () => {
                    this.stop();
                });

                return this;
            });
    }

    /**
     * Starts the connection.
     * @returns a Promise of `this` which resolves when the connection is stopped.
     */
    stop(): Promise<Connection> {
        if (this.state === ConnectionState.disconnected) {
            console.warn("Connection is already stopped.");
            return;
        }

        console.log('Connection: Stop.');

        this.state = ConnectionState.disconnected;

        var promise = protocol.abort(this);

        this.monitor.stopMonitoring();

        this._transport = null;

        return promise.then(() => this);
    }
}
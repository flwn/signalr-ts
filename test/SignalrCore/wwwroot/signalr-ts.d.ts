// Generated by dts-bundle v0.5.0

declare module 'signalr' {
    import { Connection } from 'signalr/connection';
    import { HubConnection } from 'signalr/hubs';
    import * as config from 'signalr/config';
    export function hubConnection(path?: string, hubs?: string[]): HubConnection;
    export function persistentConnection(path: string): Connection;
    export { config as config };
    export { Connection as Connection };
    export { HubConnection as HubConnection };
}

declare module 'signalr/connection' {
    import { Transport, MessageSink } from 'signalr/transport';
    import { UrlBuilder } from 'signalr/url';
    import { ConnectionConfig, Configuration } from 'signalr/config';
    import { LogLevel, LogSource, Logger } from 'signalr/logging';
    export type disposer = {
            dispose: () => void;
    };
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
    export enum ConnectionState {
            connecting = 0,
            connected = 1,
            reconnecting = 2,
            disconnected = 4,
    }
    export class Connection implements LogSource {
            config: Configuration;
            protected logger: Logger;
            logSourceId: string;
            lastMessageReceived: Date;
            groupsToken: string;
            timeouts: Timeouts;
            constructor(config: Configuration);
            /** @private */
            markLastMessage(): void;
            state: ConnectionState;
            logLevel: LogLevel;
            readonly transport: Transport;
            readonly connectionToken: string;
            readonly url: UrlBuilder;
            slowConnection: boolean;
            /** @private */
            connectionLost(): void;
            readonly messageSink: MessageSink;
            /**
                 * Subscribe to incoming messages.
                 * @returns a dispose function. Calling this function will dispose the subscription.
                 */
            onMessage<T>(handler: (message: T) => void): disposer;
            /**
                 * Subscribe to state changes.
                 * @returns a dispose function. Calling this function will dispose the subscription.
                */
            onStateChange(handler: (stateChanged: StateChangedEvent) => void): disposer;
            /** Send data to the server.
                * @returns a promise which resolves when the data is send.
                */
            send(data: any): Promise<void>;
            /** This method is used internally by the signalr client for handling incoming data.
                * @private
             */
            handleData(data: PersistentConnectionData): void;
            /**
                * Starts the connection.
                * @param {ConnectionConfig} options - Configuration for this connection.
                * @returns a Promise of `this` which resolves when the connection is succesfully started.
                */
            start(options?: ConnectionConfig): Promise<Connection>;
            /**
                * Starts the connection.
                * @returns a Promise of `this` which resolves when the connection is stopped.
                */
            stop(): Promise<Connection>;
    }
}

declare module 'signalr/hubs' {
    import { Connection } from 'signalr/connection';
    import { Configuration } from 'signalr/config';
    import { Logger } from 'signalr/logging';
    export type disposer = {
            dispose: () => void;
    };
    export class HubConnection extends Connection {
            readonly hubNames: string[];
            /**
                * Get a reference to a hub proxy.
                * @param {string} name - The name of the hub.
                */
            hub(name: string): HubProxy;
            /** Register multiple hubs at once.
                * @returns an array of HubProxy instances.
                */
            registerHubs(...names: string[]): HubProxy[];
            constructor(config: Configuration);
            handleData(data: HubInvocationResult | HubConnectionData): void;
            /**
                * Starts the hub connection and registers hubs with at least one client event subscription.
                * @returns a promise which resolves when the connection is started.
                */
            start(): Promise<HubConnection>;
            /**
                * Stops the hub connection and rejects all pending invoications.
                * @returns a promise which resolves when the connection is stopped.
                */
            stop(): Promise<HubConnection>;
            invokeHubMethod(hubOrhubName: string | HubProxy, method: string, ...args: any[]): Promise<any>;
            handleInvocationResult(result: HubInvocationErrorResult | HubInvocationResult): void;
    }
    export class HubProxy {
            name: string;
            constructor(name: string, connection: HubConnection, logger: Logger);
            /** Invokes a method on the server.
                * @param method - The method to invoke.
                * @param args - The method arguments.
                * @returns a promise which resolves when the method is succesfully invoked at the server.
                */
            invoke(method: string, ...args: any[]): Promise<any>;
            /** Registers an event handler for a client side event, invoked by the server.
                * @param method - The method to register the callback for.
                * @param callback - The callback to handle the event.
                * @returns an object with a dispose method to unregister the event handler.
                */
            on(method: string, callback: (...args: any[]) => void): disposer;
            /** This method is used by the hubConnection to invoke a client side event.
                * @private
                */
            trigger(method: string, args: any[], state?: any): void;
            readonly hasEventHandlers: boolean;
            /** State information, shared by the client and the server. */
            state: any;
            extendState(state: any): void;
    }
}

declare module 'signalr/config' {
    import { ProtocolHelper } from 'signalr/protocol';
    import { FetchHttpClient } from 'signalr/http';
    import { TransportConfiguration } from 'signalr/transport';
    export var protocol: ProtocolHelper;
    export { EventAggregator } from 'signalr/EventAggregator';
    export { setDefaultLogLevel } from 'signalr/logging';
    export var defaultHttpClient: FetchHttpClient;
    /**
        * Configure the connection with these settings.
        */
    export interface ConnectionConfig {
            /**
                * Specify which transport to use.
                */
            transport?: string | string[];
    }
    export interface TransportConfigurationType {
            new (configuration: Configuration): TransportConfiguration;
            transportName: string;
    }
    export function registerTransport(transportFactory: TransportConfigurationType): void;
    export function getTransport(name: string): TransportConfigurationType;
    export function getTransportConfiguration(transport: string | TransportConfigurationType, configuration: Configuration): TransportConfiguration;
    export class Configuration {
            readonly transportOrder: string[];
            setTransportOrder(value: string[]): this;
            http: FetchHttpClient;
            baseUrl: string;
            validate(): void;
    }
    export function initializeDefaultConfiguration(): Configuration;
}

declare module 'signalr/transport' {
    import { Connection } from 'signalr/connection';
    import { UrlBuilder } from 'signalr/url';
    export class MessageSink {
        constructor(connection: Connection);
        handleMessage(transport: Transport, message: RawMessageData): void;
        transportActive: boolean;
        transportError(e: Error): void;
        drain(): void;
        clear(): void;
    }
    export enum TransportState {
        Initializing = 0,
        Opened = 1,
        Ready = 2,
        Closed = 3,
    }
    export interface SocketAlike {
        onclose: (ev: CloseEvent) => any;
        onerror: (ev: ErrorEvent) => any;
        onmessage: (ev: MessageEvent) => any;
        onopen: (ev: Event) => any;
        readyState: number;
        close(code?: number, reason?: string): void;
        send(data: any): void | Promise<any>;
    }
    export type Transformer = (data: any) => any;
    export interface TransportConfiguration {
        name: string;
        supportsKeepAlive: boolean;
        connectSocket(url: UrlBuilder, reconnect: boolean, transport: Transport): SocketAlike;
        createSendTransformer(): Transformer;
    }
    export interface InitEvent {
        correlationId?: number;
    }
    export class Transport {
        protected _socket: SocketAlike;
        oninit: (ev: InitEvent) => void;
        constructor(transportConfiguration: TransportConfiguration, connection: Connection);
        protocol: string;
        connectionLost: (transport: this) => void;
        send(data: any): Promise<any>;
        readonly supportsKeepAlive: boolean;
        setInitialized(correlationId: number): void;
        protected _state: TransportState;
        readonly state: TransportState;
        lastMessageId: string;
        connect(cancelTimeout: Promise<number>, reconnect?: boolean): Promise<void>;
        close(): Promise<boolean>;
    }
}

declare module 'signalr/url' {
    export class UrlBuilder {
        baseUrl: string;
        connectionData: string;
        constructor(baseUrl: string, connectionData?: string);
        appRelativeUrl: string;
        transport: string;
        connectionToken: string;
        connectionId: string;
        negotiate(): string;
        start(): string;
        abort(): string;
        send(): string;
        poll(messageId: string): string;
        connect(reconnect?: boolean): string;
        build(path: string): string;
        setHubs(...hubs: string[]): void;
    }
}

declare module 'signalr/logging' {
    export enum LogLevel {
        Off = 0,
        Errors = 1,
        Warnings = 2,
        Info = 3,
        Debug = 4,
        All,
    }
    export interface Logger {
        error(msg: string, ...optionalParams: any[]): void;
        info(msg: string, ...optionalParams: any[]): void;
        warn(msg: string, ...optionalParams: any[]): void;
        log(msg: string, ...optionalParams: any[]): void;
        level: LogLevel;
    }
    export interface LogSource {
        logSourceId: string;
    }
    export function getLogger(source: LogSource): Logger;
    export function setLogLevel(source: LogSource, level: LogLevel): void;
    export function setDefaultLogLevel(level: LogLevel): void;
}

declare module 'signalr/protocol' {
    import { Connection } from 'signalr/connection';
    import { Transport } from 'signalr/transport';
    import { ConnectionConfig } from 'signalr/config';
    export class ProtocolHelper {
        negotiate(connection: Connection): Promise<NegotiationResult>;
        reconnect(connection: Connection): Promise<void>;
        connect(connection: Connection, negotiationResult: NegotiationResult, options?: ConnectionConfig): Promise<Transport>;
        start(connection: Connection): Promise<any>;
        abort(connection: Connection): Promise<any>;
    }
}

declare module 'signalr/http' {
    /**
      * This class is a simple api for firing XMLHttpRequests. This one implements the get and post methods using the fetch api.
      */
    export class FetchHttpClient {
        constructor();
        /** Shorthand for a fetch request with method 'POST'. */
        post<TResponse>(url: string, formData?: FormData): Promise<TResponse>;
        /** Shorthand for a fetch request with method 'GET'. */
        get<TResponse>(url: string): Promise<TResponse>;
    }
}

declare module 'signalr/EventAggregator' {
    export interface IDisposable {
            /**
                * Disposes the subscription.
                */
            dispose(): void;
    }
    export class EventAggregator {
            readonly hasAnySubscriptions: boolean;
            publish(eventName: string, payload?: any): void;
            /**
                * Subscribe to a event.
                */
            subscribe(eventName: string, callback: (payload: any, eventName: string) => void): IDisposable;
    }
}


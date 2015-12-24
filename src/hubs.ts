///<reference path="./_wire.d.ts" />
import {Connection, ConnectionState} from './connection';
import {EventAggregator} from './config';


interface Lookup<TVal> {
    [key: string]: TVal;
}

interface Lookup<TVal> {
    [key: number]: TVal;
}

interface PendingInvocation {
    resolve: (result: any) => void;
    reject: (error: any) => void;
    hub?: HubProxy;
}


function isHubInvocationResult(data: HubInvocationResult|HubConnectionData) : data is HubInvocationResult {
    return typeof data['I'] !== "undefined";
}

function isErrorResult(result: HubInvocationErrorResult|HubInvocationResult): result is HubInvocationErrorResult {
    return typeof result['E'] !== "undefined";
}

export type disposer = { dispose: () => void };

export class HubConnection extends Connection {
    private messageId: number = 0;
    private _hubs: Lookup<HubProxy> = {};
    private _pendingInvocations: Lookup<PendingInvocation> = {}

    get hubNames(): string[] {
        return Object.keys(this._hubs);
    }

    /**
     * Get a reference to a hub proxy. 
     * @param {string} name - The name of the hub.  
     */
    hub(name: string): HubProxy {
        let lcaseName = name.toLowerCase();
        if (false === this._hubs.hasOwnProperty(lcaseName)) {
            if(this.state === ConnectionState.connected || this.state === ConnectionState.reconnecting) {
                throw new Error('Cannot register hub after de connecting has been started.')
            }
            this._hubs[lcaseName] = new HubProxy(name, this);
        }
        return this._hubs[lcaseName];
    }
    
    /** Register multiple hubs at once.
     * @returns an array of HubProxy instances.
     */
    registerHubs(...names: string[]): HubProxy[] {
        return names.map(hub => this.hub(hub));
    }

    constructor(baseUrl?: string) {
        super(baseUrl);
    }

    handleData(data: HubInvocationResult|HubConnectionData) {
        console.log('handle hub data', data);
        
        if (isHubInvocationResult(data)) {
            this.handleInvocationResult(data);
            return;
        } else {
            
            if (typeof data['M'] !== "undefined") {
                let messages = (data).M;
                messages.forEach((msg: ClientMethodInvocation) => {
                    let hubName:string = msg.H.toLowerCase();
                    let method: string = msg.M;
                    if(hubName in this._hubs) {
                        let proxy = this._hubs[hubName];
                        proxy.trigger(method, msg.A, msg.S);
                    } else {
                        console.warn(`No proxy for hub '${hubName}' to invoke method '${method}' on.`);
                    }
                });
                //prevent double handling of messages by the connection;
                delete data['M'];
            }
    
            //let the base connection handle the generic stuff like groups, etc.
            super.handleData(data);
        }
    }

    /**
     * Starts the hub connection and registers hubs with at least one client event subscription.
     * @returns a promise which resolves when the connection is started.
     */
    start() : Promise<HubConnection> {
        let activeHubs = this.hubNames
            .filter(hubName => this._hubs[hubName].hasEventHandlers);
            
        this.url.setHubs(...activeHubs);

        return super.start();
    }

    /**
     * Stops the hub connection and rejects all pending invoications.
     * @returns a promise which resolves when the connection is stopped.
     */
    stop(): Promise<HubConnection> {
        let stopPromise = super.stop();

        Object.keys(this._pendingInvocations).forEach((key) => {
            this._pendingInvocations[key].reject(new Error('Connection is being stopped.'));
            delete this._pendingInvocations[key];
        });

        return stopPromise;
    }

    invokeHubMethod(hubOrhubName: string|HubProxy, method: string, ...args: any[]): Promise<any> {
        let id = this.messageId++;
        let invocation: ServerHubInvocation = { 
            "H": null, 
            "M": method, 
            "A": args || [], 
            "I": id };
        
        let hub: HubProxy;
        
        if( typeof hubOrhubName === "string"){
            invocation.H = hubOrhubName;
        } else {
            hub = hubOrhubName;
            invocation.H = hub.name;
            if(typeof hub.state !== "undefined" && hub.state !== null) {
                invocation.S = hub.state;
            }
        }
        
        return new Promise((resolve, reject)=> {

            this._pendingInvocations[id] = {
                resolve, reject, hub
            }
    
            super.send(invocation)
                .catch((e) => {
                    console.warn(`Error sending hub method invocation with id ${id}.`, e);
                    delete this._pendingInvocations[id];
                    reject(e);
                });
        });
    }

    handleInvocationResult(result: HubInvocationErrorResult|HubInvocationResult) {
        let invocationId = result.I;
        let pendingInvocation = this._pendingInvocations[invocationId];
        
        if(result.P) {
            console.log('Progress messages are not supported. Skip hub response.');
            return;
        }
        
        if (!pendingInvocation) {
            console.warn(`Invoication with id ${invocationId} not found.`);
            return;
        }
        
        delete this._pendingInvocations[invocationId];

        if((typeof result.S !== "undefined") && (typeof pendingInvocation.hub === "object")) {
            pendingInvocation.hub.extendState(result.S);
        }
        
        if (isErrorResult(result)) {
            if (result.T) {
                //stacktrace
                console.error(`HubInvocationErrorResult '${result.E}'. Stack trace:\n${result.T}`);
            }
            let error = new Error(result.E);
            error['source'] = result.H ? "HubException" : "Exception";
            error['data'] = result.D;
            pendingInvocation.reject(error);
        } else {
            console.log(`Hub method invocation ${ result.I} completed with result: ${ result.R || '<void>'}`);
            pendingInvocation.resolve(result.R);
        }
    }
}

export class HubProxy {
    private _eventAggregator: EventAggregator = new EventAggregator();

    constructor(public name: string, private connection: HubConnection) {
    }

    /** Invokes a method on the server.
     * @param method - The method to invoke.
     * @param args - The method arguments.
     * @returns a promise which resolves when the method is succesfully invoked at the server.
     */
    invoke(method: string, ...args: any[]): Promise<any> {
        return this.connection.invokeHubMethod(this, method, ...args);
    }

    /** Registers an event handler for a client side event, invoked by the server.
     * @param method - The method to register the callback for.
     * @param callback - The callback to handle the event.
     * @returns an object with a dispose method to unregister the event handler.
     */
    on(method: string, callback: (...args: any[]) => void): disposer {
        return this._eventAggregator.subscribe(method.toLowerCase(), callback);
    }
    
    /** This method is used by the hubConnection to invoke a client side event.
     * @private
     */
    trigger(method: string, args: any[], state?: any): void {
        console.log(`Hub '${this.name}': trigger method '${method}' (${args.length} arguments).`, args);
        this.extendState(state);
        this._eventAggregator.publish(method.toLowerCase(), args);
    }
    
    get hasEventHandlers() : boolean {
        return this._eventAggregator.hasAnySubscriptions;
    }

    /** State information, shared by the client and the server. */
    state: any;
    
    extendState(state: any) {
        if(typeof(state) !== "object" || state === null) {
            return;
        }
        
        if(typeof this.state ==="undefined" || this.state === null ) {
            this.state = {};
        }
        Object.keys(state).forEach(key => {
            this.state[key] = state[key];
        });
    }
}
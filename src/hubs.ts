///<reference path="./_wire.d.ts" />
import {Connection} from './connection';
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


type disposer = () => void;

export class HubConnection extends Connection {
    private messageId: number = 0;
    private _hubs: Lookup<HubProxy> = {};
    private _pendingInvocations: Lookup<PendingInvocation> = {}

    get hubNames(): string[] {
        return Object.keys(this._hubs);
    }

    hub(name: string): HubProxy {
        let lcaseName = name.toLowerCase();
        if (false === this._hubs.hasOwnProperty(lcaseName)) {
            this._hubs[lcaseName] = new HubProxy(name, this);
        }
        return this._hubs[lcaseName];
    }
    
    registerHubs(...names: string[]): HubProxy[] {
        return names.map(hub => this.hub(hub));
    }

    constructor(baseUrl?: string) {
        super(baseUrl);
    }

    handleData(data: HubInvocationResult|HubConnectionData) {
        console.log('handle hub data', data);
        
        if (typeof data['I'] !== "undefined") {
            this.handleInvocationResult(<HubInvocationResult>data);
            return;
        } else if (typeof data['M'] !== "undefined") {
            let messages = (<HubConnectionData>data).M;
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

    start() {
        this.url.setHubs(...this.hubNames);

        return super.start();
    }

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
                    delete this._pendingInvocations[id];
                    reject(e);
                });
        });
    }

    handleInvocationResult(result: HubInvocationErrorResult|HubInvocationResult) {
        let invocationId = result.I;
        let pendingInvocation = this._pendingInvocations[invocationId];

        if (!pendingInvocation) {
            console.warn(`Invoication with id ${invocationId} not found.`);
            return;
        }
        
        delete this._pendingInvocations[invocationId];

        if((typeof result.S !== "undefined") && (typeof pendingInvocation.hub === "object")) {
            pendingInvocation.hub.extendState(result.S);
        }
        
        if (typeof (<HubInvocationErrorResult>result).E !== "undefined") {
            let errorResult = <HubInvocationErrorResult>result;
            if (errorResult.T) {
                //stacktrace
                console.error(errorResult.E + "\n" + errorResult.T + ".");
            }
            let error = new Error(errorResult.E);
            error['source'] = errorResult.H ? "HubException" : "Exception";
            error['data'] = errorResult.D;
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

    invoke(method: string, ...args: any[]): Promise<any> {
        return this.connection.invokeHubMethod(this, method, ...args);
    }

    on(method: string, callback: (...args: any[]) => void): disposer {
        return this._eventAggregator.subscribe(method.toLowerCase(), callback);
    }
    
    trigger(method: string, args: any[], state?: any): void {
        console.log(`Hub '${this.name}': trigger method '${method}' (${args.length} arguments).`, args);
        this.extendState(state);
        this._eventAggregator.publish(method.toLowerCase(), args);
    }

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
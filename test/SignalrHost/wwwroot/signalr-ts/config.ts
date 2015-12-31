import {ProtocolHelper} from './protocol';
import {FetchHttpClient} from './http';
import {TransportConfiguration} from './transport';



export var protocol = new ProtocolHelper();

export {EventAggregator} from './EventAggregator';

export {setDefaultLogLevel} from './logging';

export var defaultHttpClient = new FetchHttpClient();
 
/**
 * Configure the connection with these settings.
 */
export interface ConnectionConfig {
	/**
	 * Specify which transport to use. 
	 */
    transport?: string | string[];
}
var transportLookup: { [key: string]: TransportConfigurationType } = {};
var defaultTransportOrder: string[] = [];

export interface TransportConfigurationType {
    new (configuration: Configuration): TransportConfiguration;
    name: string;
}
export function registerTransport(transportFactory: TransportConfigurationType) {
    let name = transportFactory.name.toLowerCase();
    if (defaultTransportOrder.indexOf(name) >= 0) {
        return;
    }
    defaultTransportOrder.push(name);
    transportLookup[name] = transportFactory;
}

export function getTransport(name:string): TransportConfigurationType {
    name = name.toLowerCase();
    if(transportLookup[name]) {
        return transportLookup[name];
    }
    return null;
}
export function getTransportConfiguration(transport: string|TransportConfigurationType, configuration: Configuration) {
    let configConstructor: TransportConfigurationType;
    if(typeof transport === "string") {
        configConstructor = getTransport(transport);
    } else {
        configConstructor = transport;
    }
    
    return new configConstructor(configuration);
}


export class Configuration {
    private _transports: string[];


    get transportOrder(): string[] {
        return this._transports;
    }

    setTransportOrder(value: string[]): this {
        let newArray = [];

        if (Array.isArray(value)) {
            value.forEach(t => {
                let name = t.toLowerCase();
                if (defaultTransportOrder.indexOf(name) >= 0) {
                    newArray.push(name);
                } else {
                    throw new Error(`Transport ${t} is not supported.`);
                }
            });
        }

        if (newArray.length === 0) {
            throw new Error('Please provide an array with at least 1 transport');
        }

        this._transports = newArray;

        return this;
    }

    http: FetchHttpClient;
    baseUrl: string;
    
    
    validate() {
        if(this.http == null) {
            throw new Error("Configuration Error: No http configured.");
        }
        if(typeof this.baseUrl !== "string") {            
            throw new Error("Configuration Error: baseUrl is invalid.");
        }
        if(this._transports.length <= 0) {
            throw new Error("Configuration Error: no transports configured.");
        }
    }
}

export function initializeDefaultConfiguration(): Configuration {

    var configuration = new Configuration();
    configuration.baseUrl = '/signalr';
    configuration.setTransportOrder(defaultTransportOrder);
    configuration.http = defaultHttpClient;

    return configuration;
}
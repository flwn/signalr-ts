import {Connection} from './connection';
import {HubConnection} from './hubs';
import * as config from './config';

import ws from './transport-websocket';
import lp from './transport-longpolling';

config.registerTransport(ws);
config.registerTransport(lp);



export function hubConnection(path: string = '/signalr', hubs: string[] = []): HubConnection {
    let connectionConfig = config.initializeDefaultConfiguration();
    connectionConfig.baseUrl = path;
    
	var connection = new HubConnection(connectionConfig);
	connection.registerHubs(...hubs);
    
	return connection;
}

export function persistentConnection(path: string): Connection {
	if (typeof path !== "string") {
		throw new Error('please provide a path');
	}
    
    let connectionConfig = config.initializeDefaultConfiguration();
    connectionConfig.baseUrl = path;
    
	return new Connection(connectionConfig);
}


export { config as config}; 
export { Connection as Connection}; 
export { HubConnection as HubConnection}; 
import {Connection} from './connection';
export {Connection} from './connection';

import {HubConnection} from './hubs';

export {HubConnection} from './hubs';

export function hubConnection(path: string = '/signalr', hubs: string[] = []): HubConnection {
	var connection = new HubConnection(path);

	connection.registerHubs(...hubs);

	return connection;
}

export function persistentConnection(path: string): Connection {
	if (typeof path !== "string") {
		throw new Error('please provide a path');
	}
	return new Connection(path);
}

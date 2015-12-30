import {ProtocolHelper} from './protocol';
import {HttpClient} from './http';

export var protocol = new ProtocolHelper();

export {EventAggregator} from './EventAggregator';


export var http = new HttpClient();

/**
 * Configure the connection with these settings.
 */
export interface ConnectionConfig {
	/**
	 * Specify which transport to use. 
	 */
	transport?: string | string[];
}
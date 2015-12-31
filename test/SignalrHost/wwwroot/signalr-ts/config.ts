import {ProtocolHelper} from './protocol';
import {FetchHttpClient} from './http';

export var protocol = new ProtocolHelper();

export {EventAggregator} from './EventAggregator';

export {setDefaultLogLevel} from './logging';

export var http = new FetchHttpClient();

/**
 * Configure the connection with these settings.
 */
export interface ConnectionConfig {
	/**
	 * Specify which transport to use. 
	 */
	transport?: string | string[];
}

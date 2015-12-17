import {ProtocolHelper} from './protocol';

export var protocol = new ProtocolHelper();

export {EventAggregator} from './EventAggregator';

/**
 * Configure the connection with these settings.
 */
export interface ConnectionConfig {
	/**
	 * Specify which transport to use. 
	 */
	transport?: string | string[];
}
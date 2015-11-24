
export interface IDisposable {
	/**
	 * Disposes the subscription.
	 */
	dispose(): void;
}

declare type eventCallback = (payload: any, eventName: string) => void;



export class EventAggregator {
	private eventLookup: { [key: string]: Array<eventCallback> } = {};

	publish(eventName: string, payload?: any) {
		if (typeof eventName !== 'string') {
			throw new Error('eventName must be of type string.');
		}

		let callbacks = this.eventLookup[eventName];
		if (callbacks) {
			callbacks.forEach(cb => {
				try {
					cb(payload, eventName);
				} catch (e) {
					//todo: logging?
				}
			});
		}
	}

	/**
	 * Subscribe to a event. 
	 */
	subscribe(eventName: string, callback: (payload: any, eventName: string) => void): IDisposable {
		if (typeof eventName !== 'string') {
			throw new Error('eventName must be of type string.');
		}
		if (typeof callback !== 'function') {
			throw new Error('callback must be of type function.');
		}

		let eventLookup = this.eventLookup[eventName] || (this.eventLookup[eventName] = []);

		eventLookup.push(callback);

		return {
			dispose: () => {
				let id = eventLookup.indexOf(callback);
				if (id !== -1) {
					eventLookup.splice(id, 1);
				}
			}
		}
	}

}
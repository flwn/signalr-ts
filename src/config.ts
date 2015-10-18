import {HttpClient, HttpResponseMessage} from 'aurelia-http-client';

import {ProtocolHelper} from './protocol';

export var protocol = new ProtocolHelper(new HttpClient());

export {EventAggregator} from 'aurelia-event-aggregator';
import {Transport, MessageSink, TransportState, SocketAlike} from './transport';
import {UrlBuilder} from './url';

export class WebSocketTransport extends Transport {

    constructor(private url: UrlBuilder, sink: MessageSink) {
        super(sink);
    }

    static get name(): string {
        return "webSockets";
    }
    get name(): string {
        return "webSockets";
    }


    get supportsKeepAlive(): boolean {
        return true;
    }

    send(data: any): Promise<any> {
        let payload = typeof (data) === "string" ? data : JSON.stringify(data);

        this._socket.send(payload);
        return Promise.resolve(null);
    }
    
    createSocket() : SocketAlike {
        return new WebSocket(this.url.connect());
    }
}
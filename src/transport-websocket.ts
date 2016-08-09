import { Transport, SocketAlike, TransportConfiguration, Transformer } from './transport';
import { UrlBuilder } from './url';
import { Logger } from './logging';

function transformSend(data: any): any {
    let payload = typeof (data) === "string" ? data : JSON.stringify(data);

    return payload;
}

export default class webSockets implements TransportConfiguration {
    static transportName: string = "webSockets";

    name = webSockets.transportName;
    supportsKeepAlive = true;

    connectSocket(uri: UrlBuilder, reconnect: boolean, transport: Transport, log: Logger): SocketAlike {
        return new WebSocket(uri.connect(reconnect));
    }

    createSendTransformer(): Transformer {
        return transformSend;
    }
}

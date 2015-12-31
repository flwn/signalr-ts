import {Transport, SocketAlike, TransportConfiguration, Transformer} from './transport';
import {UrlBuilder} from './url';


function transformSend(data: any): any {
    let payload = typeof (data) === "string" ? data : JSON.stringify(data);

    return payload;
}

export default class webSockets implements TransportConfiguration {
    public static name: string = "webSockets";
    name = webSockets.name;

    connectSocket(uri: UrlBuilder, reconnect: boolean, transport: Transport): SocketAlike {
        return new WebSocket(uri.connect(reconnect));
    }

    createSendTransformer(): Transformer {
        return transformSend;
    }
}

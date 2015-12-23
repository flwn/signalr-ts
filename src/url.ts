
export class UrlBuilder {

    constructor(public baseUrl: string, public connectionData: string = null) { }

    appRelativeUrl: string = '';
    transport: string;
    connectionToken: string;
    connectionId: string;

    negotiate(): string {
        return this.build('/negotiate');
    }

    start(): string {
        return this.build('/start');
    }
    abort(): string {
        return this.build('/abort');
    }
    
    send(): string {
        return this.build('/send');
    }

    poll(messageId: string): string {
        var url = `${this.build('/poll') }&messageId=${encodeURIComponent(messageId) }`;

        return url;
    }

    
    connect(reconnect: boolean = false): string {
        var urlPath = this.build(reconnect === true ? '/reconnect' : '/connect');
        urlPath += '&tid=' + Math.floor(Math.random() * 11);

        var protocol = location.protocol;

        if (this.transport === "webSockets") {
            //http: -> ws:
            //https: -> wss:
            protocol = protocol.replace('http', 'ws');
        }

        var connectUrl = protocol + '//' + location.host + urlPath;

        return connectUrl;
    }


    build(path: string): string {
        //todo: use this.appRelativeUrl
        var url = this.baseUrl + path + '?clientProtocol=1.5';

        url += '&connectionData=' + this.connectionData;

        if (this.connectionToken) {
            url += '&connectionToken=' + encodeURIComponent(this.connectionToken);
        }
        if (this.transport) {
            url += '&transport=' + this.transport;
        }

        return url;
    }

    setHubs(...hubs: string[]): void {
        let arrayValues = hubs
            .map(hub => `{"name":"${hub}"}`)
            .join(',');

        let queryString = encodeURIComponent('[' + arrayValues + ']');

        this.connectionData = queryString;
    }


}
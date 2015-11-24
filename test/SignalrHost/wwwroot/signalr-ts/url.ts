
export class UrlBuilder {

    constructor(public baseUrl: string, public connectionData: string = null) { }

    negotiate(): string {
        return this.build('/negotiate');
    }

    start(connectionToken: string, transport: string): string {
        return this.build('/start', transport, connectionToken);
    }
    abort(connectionToken: string, transport: string): string {
        return this.build('/abort', transport, connectionToken);
    }

    connect(connectionToken: string, transport: string): string {
        var urlPath = this.build('/connect', transport, connectionToken);
        urlPath += '&tid=' + Math.floor(Math.random() * 11);

        var protocol = location.protocol;

        if (transport === "webSockets") {
            //http: -> ws:
            //https: -> wss:
            protocol = protocol.replace('http', 'ws');
        }

        var connectUrl = protocol + '//' + location.host + urlPath;

        return connectUrl;
    }


    build(path: string, transport?: string, connectionToken?: string): string {
        var url = this.baseUrl + path + '?clientProtocol=1.5';

        url += '&connectionData=' + this.connectionData;

        if (connectionToken) {
            url += '&connectionToken=' + encodeURIComponent(connectionToken);
        }
        if (transport) {
            url += '&transport=webSockets';
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
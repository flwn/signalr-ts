import {hubConnection, HubConnection, config} from 'signalr-ts/index';

var outstanding = 2;
config.setDefaultLogLevel(Number.MAX_VALUE);
var connection = hubConnection();

//connection.logLevel = Number.MAX_VALUE;

var helloServerResponse: any = null;
var helloClientMessage: any[] = null;

connection.hub('myHub')
    .on('helloClient', (args: any[], methodName: string) => {
        helloClientMessage = args;
        console.log('helloClientMessage received', helloClientMessage);
        complete();
    });

connection.start()
    .then((x: HubConnection) => {
        x.hub('myHub')
            .invoke('HelloServer', 'John Doe')
            .then(r => {
                helloServerResponse = r;
                console.log('helloServerResponse', helloServerResponse);
                complete();
            });
    });


function complete() {
    if (--outstanding > 0) {
        return;
    }

    console.log(`Tests complete.`);
}
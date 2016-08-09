function executeTests(signalr) {
    var outstanding = 2;
    signalr.config.setDefaultLogLevel(Number.MAX_VALUE);
    var connection = signalr.hubConnection();

    var helloServerResponse = null;
    var helloClientMessage = null;

    connection.hub('myHub')
        .on('helloClient', (args, methodName) => {
            helloClientMessage = args;
            console.log('helloClientMessage received', helloClientMessage);
            complete();
        });


    connection.start()
        .then((x) => {
            x.hub('myHub')
                .invoke('HelloServer', 'John Doe')
                .then(r => {
                    helloServerResponse = r;
                    console.log('helloServerResponse', helloServerResponse);
                    complete();
                });
        });


    function complete() {
        --outstanding;

        if (outstanding > 0) {
            document.getElementById("output").innerText = outstanding + " tests of " + 2;
            return;
        }

        console.log(`Tests complete.`);
        document.getElementById("output").innerText = "Tests complete.";
    }
}
interface RawMessageData {

    /**
      * Message Id
      */
    C?: string;
    
    /**
      * Transport Initialized
      */
    S?: number;
}


interface PersistentConnectionData extends RawMessageData {

    /**
      * Messages
      */
    M?: Array<any>;

    /**
      * Groups token
      */
    G?: string;
    
    /**
     * Long Poll Delay
     */
    L?: number;
    
    /**
      * Should reconnect?
      */
    T?: number;
}


interface NegotiationResult {
    "Url": string;
    "ConnectionToken": string;
    "ConnectionId": string;
    "KeepAliveTimeout": number;
    "DisconnectTimeout": number;
    "TryWebSockets": boolean;
    "ProtocolVersion": string;
    "TransportConnectTimeout": number;
}

interface StartResponse {
    /**
      * Response should be "started".
      */
    Response: string;
}


//#region Hub Types

interface HubConnectionData extends PersistentConnectionData {
    M?: Array<ClientMethodInvocation>;
}

interface MayHaveState {
    /**
      * The caller state from this hub.
      */
    S?: { [key: string]: any };
}

interface HubInvocation extends MayHaveState {
    /**
      * The hub name
      */
    H: string;

    /**
      * The hub method
      */
    M: string;

    /**
      * The hub method arguments
      */
    A: Array<any>;
}

/**
  * Request a hub invocation at the server
  */
interface ServerHubInvocation extends HubInvocation {

    /**
      * The callback identifier
      */
    I: number;
}

/**
  * The server requests an invocation at the client.
  */
interface ClientMethodInvocation extends HubInvocation {

}


interface HubProgressUpdate {
    /**
      * The callback identifier
      */
    I: string;

    //Data
    D: any;
}

interface HubInvocationResult extends MayHaveState {
    /**
      * The callback identifier
      */
    I: number;


    /**
      * The return value of the hub
      */
    R?: any;


    /**
      * Not implemented (ProgressUpdate)
      */
    P?: HubProgressUpdate;
}

interface HubInvocationErrorResult extends HubInvocationResult {

    /**
      * Indicates whether the Error is a HubException
      */
    H?: boolean;

    /**
      * The error message returned from the hub invocation.
      */
    E: string;

    /**
      * Extra error data
      */
    D?: any;

    /**
      * Error StackTrace
      */
    T?: any;
}




interface KeepAliveResponse {
}

//#endregion
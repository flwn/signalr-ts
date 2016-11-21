var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
System.register("logging", [], function(exports_1, context_1) {
    "use strict";
    var __moduleName = context_1 && context_1.id;
    var LogLevel, defaultLogLevel, LoggerKey, ConsoleLogger;
    function getLogger(source) {
        if (typeof source !== "object" || source === null) {
            throw new Error('Invalid log source');
        }
        if (!source[LoggerKey]) {
            source[LoggerKey] = new ConsoleLogger();
        }
        return source[LoggerKey];
    }
    exports_1("getLogger", getLogger);
    function setLogLevel(source, level) {
        if (typeof level !== "number") {
            throw new Error('level must be a number');
        }
        var logger = getLogger(source);
        logger.level = level;
    }
    exports_1("setLogLevel", setLogLevel);
    function setDefaultLogLevel(level) {
        if (typeof (level) !== "number") {
            throw new Error('LogLevel must be a number');
        }
        defaultLogLevel = level;
    }
    exports_1("setDefaultLogLevel", setDefaultLogLevel);
    function noop() { }
    function logToConsole(level, message) {
        var optionalParams = [];
        for (var _i = 2; _i < arguments.length; _i++) {
            optionalParams[_i - 2] = arguments[_i];
        }
        var formattedMessage = "[" + new Date().toTimeString() + "] SignalR-ts: " + message;
        console[level].apply(console, [formattedMessage].concat(optionalParams));
    }
    return {
        setters:[],
        execute: function() {
            (function (LogLevel) {
                LogLevel[LogLevel["Off"] = 0] = "Off";
                LogLevel[LogLevel["Errors"] = 1] = "Errors";
                LogLevel[LogLevel["Warnings"] = 2] = "Warnings";
                LogLevel[LogLevel["Info"] = 3] = "Info";
                LogLevel[LogLevel["Debug"] = 4] = "Debug";
                LogLevel[LogLevel["All"] = Number.MAX_VALUE] = "All";
            })(LogLevel || (LogLevel = {}));
            exports_1("LogLevel", LogLevel);
            defaultLogLevel = LogLevel.Off;
            LoggerKey = '__loglevel';
            ConsoleLogger = (function () {
                function ConsoleLogger() {
                    this._level = defaultLogLevel;
                    this.initLoggers();
                }
                Object.defineProperty(ConsoleLogger.prototype, "level", {
                    get: function () {
                        return this._level;
                    },
                    set: function (value) {
                        this._level = value;
                        this.initLoggers();
                    },
                    enumerable: true,
                    configurable: true
                });
                ConsoleLogger.prototype.initLoggers = function () {
                    var level = this._level;
                    this.error = this.warn = this.info = this.log = noop;
                    if (level >= LogLevel.Errors) {
                        this.error = logToConsole.bind(this, 'error');
                        if (level >= LogLevel.Warnings) {
                            this.warn = logToConsole.bind(this, 'warn');
                            if (level >= LogLevel.Info) {
                                this.info = logToConsole.bind(this, 'info');
                                if (level >= LogLevel.Debug) {
                                    this.log = logToConsole.bind(this, 'log');
                                }
                            }
                        }
                    }
                };
                return ConsoleLogger;
            }());
        }
    }
});
System.register("url", [], function(exports_2, context_2) {
    "use strict";
    var __moduleName = context_2 && context_2.id;
    var UrlBuilder;
    return {
        setters:[],
        execute: function() {
            UrlBuilder = (function () {
                function UrlBuilder(baseUrl, connectionData) {
                    if (connectionData === void 0) { connectionData = null; }
                    this.baseUrl = baseUrl;
                    this.connectionData = connectionData;
                    this.appRelativeUrl = '';
                }
                UrlBuilder.prototype.negotiate = function () {
                    return this.build('/negotiate');
                };
                UrlBuilder.prototype.start = function () {
                    return this.build('/start');
                };
                UrlBuilder.prototype.abort = function () {
                    return this.build('/abort');
                };
                UrlBuilder.prototype.send = function () {
                    return this.build('/send');
                };
                UrlBuilder.prototype.poll = function (messageId) {
                    var url = this.build('/poll') + "&messageId=" + encodeURIComponent(messageId);
                    return url;
                };
                UrlBuilder.prototype.connect = function (reconnect) {
                    if (reconnect === void 0) { reconnect = false; }
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
                };
                UrlBuilder.prototype.build = function (path) {
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
                };
                UrlBuilder.prototype.setHubs = function () {
                    var hubs = [];
                    for (var _i = 0; _i < arguments.length; _i++) {
                        hubs[_i - 0] = arguments[_i];
                    }
                    var arrayValues = hubs
                        .map(function (hub) { return ("{\"name\":\"" + hub + "\"}"); })
                        .join(',');
                    var queryString = encodeURIComponent('[' + arrayValues + ']');
                    this.connectionData = queryString;
                };
                return UrlBuilder;
            }());
            exports_2("UrlBuilder", UrlBuilder);
        }
    }
});
System.register("transport", ["logging"], function(exports_3, context_3) {
    "use strict";
    var __moduleName = context_3 && context_3.id;
    var logging_1;
    var MessageSink, SocketState, TransportState, Transport;
    return {
        setters:[
            function (logging_1_1) {
                logging_1 = logging_1_1;
            }],
        execute: function() {
            MessageSink = (function () {
                function MessageSink(connection) {
                    this.connection = connection;
                    this.messageBuffer = [];
                    this.transportActive = false;
                    this.logger = logging_1.getLogger(connection);
                }
                MessageSink.prototype.handleMessage = function (transport, message) {
                    if (typeof message !== "object" || message === null) {
                        this.logger.warn('Unsupported message format received');
                        return;
                    }
                    this.connection.markLastMessage();
                    if (Object.keys(message).length === 0) {
                        //keep alive
                        return;
                    }
                    if (typeof message.C !== "undefined") {
                        transport.lastMessageId = message.C;
                    }
                    if (!this.transportActive) {
                        this.messageBuffer.push(message);
                        if (typeof (message.S) !== "undefined") {
                            this.logger.log('MessageSink: init received', message.S);
                            this.transportActive = true;
                            transport.setInitialized(message.S);
                            this.drain();
                        }
                    }
                    else {
                        this.connection.handleData(message);
                    }
                };
                MessageSink.prototype.transportError = function (e) {
                    //todo: handle errors.
                };
                MessageSink.prototype.drain = function () {
                    while (this.messageBuffer.length > 0) {
                        var message = this.messageBuffer.shift();
                        this.connection.handleData(message);
                    }
                };
                MessageSink.prototype.clear = function () {
                    this.messageBuffer = [];
                };
                return MessageSink;
            }());
            (function (SocketState) {
                /**
                 * The connection is not yet open.
                 */
                SocketState[SocketState["CONNECTING"] = 0] = "CONNECTING";
                /**
                 * The connection is open and ready to communicate.
                 */
                SocketState[SocketState["OPEN"] = 1] = "OPEN";
                /**
                 * The connection is in the process of closing.
                 */
                SocketState[SocketState["CLOSING"] = 2] = "CLOSING";
                /**
                 * The connection is closed or couldn't be opened.
                 */
                SocketState[SocketState["CLOSED"] = 3] = "CLOSED";
            })(SocketState || (SocketState = {}));
            (function (TransportState) {
                TransportState[TransportState["Initializing"] = 0] = "Initializing";
                TransportState[TransportState["Opened"] = 1] = "Opened";
                TransportState[TransportState["Ready"] = 2] = "Ready";
                TransportState[TransportState["Closed"] = 3] = "Closed";
            })(TransportState || (TransportState = {}));
            exports_3("TransportState", TransportState);
            Transport = (function () {
                function Transport(transportConfiguration, connection) {
                    this.transportConfiguration = transportConfiguration;
                    this.connection = connection;
                    this._socket = null;
                    this._state = TransportState.Initializing;
                    this.lastMessageId = null;
                    this._beforeSend = transportConfiguration.createSendTransformer();
                    this.protocol = transportConfiguration.name;
                    this._sink = new MessageSink(connection);
                    this.logger = logging_1.getLogger(connection);
                }
                Transport.prototype.send = function (data) {
                    var payload = this._beforeSend(data);
                    var result = this._socket.send(payload);
                    return Promise.resolve(result);
                };
                Transport.prototype.connectSocket = function (reconnect) {
                    return this.transportConfiguration.connectSocket(this.connection.url, reconnect, this, this.logger);
                };
                Object.defineProperty(Transport.prototype, "supportsKeepAlive", {
                    get: function () {
                        return this.transportConfiguration.supportsKeepAlive;
                    },
                    enumerable: true,
                    configurable: true
                });
                Transport.prototype.setInitialized = function (correlationId) {
                    if (this._state != TransportState.Opened) {
                        throw new Error('transport not opened');
                    }
                    this._state = TransportState.Ready;
                    if (!this.oninit) {
                        this.logger.log('No oninit handler...');
                    }
                    else {
                        this.oninit({ correlationId: correlationId });
                    }
                };
                Object.defineProperty(Transport.prototype, "state", {
                    get: function () {
                        return this._state;
                    },
                    enumerable: true,
                    configurable: true
                });
                Transport.prototype.connect = function (cancelTimeout, reconnect) {
                    var _this = this;
                    if (reconnect === void 0) { reconnect = false; }
                    this.logger.log("Connecting " + this.protocol + " transport.");
                    if (this._socket !== null) {
                        return Promise.reject(new Error("A socket is already set to the instance of this transport."));
                    }
                    return new Promise(function (resolve, reject) {
                        var socket = _this.connectSocket(reconnect);
                        var opened = false;
                        cancelTimeout.then(function (timeout) {
                            if (opened) {
                                return;
                            }
                            _this.logger.warn('(Re)connect timed out.', reconnect);
                            socket.close();
                            _this._socket = null;
                            reject(new Error("Timeout: Could not connect transport within " + timeout + "ms."));
                        });
                        socket.onopen = function () {
                            _this._state = TransportState.Opened;
                            opened = true;
                            resolve();
                        };
                        socket.onerror = function (ev) {
                            if (ev instanceof Error) {
                                _this._sink.transportError(ev);
                            }
                            else if (ev instanceof ErrorEvent) {
                                var error = new Error("Poll Socket Error: " + ev.message + ".");
                                _this._sink.transportError(error);
                            }
                        };
                        socket.onclose = function (ev) {
                            _this._state = TransportState.Closed;
                            _this.logger.log('Socket onclose');
                            if (!opened) {
                                reject(new Error("Connection closed before really opened (wasClean: " + ev.wasClean + "; code: " + ev.code + "; reason: " + ev.reason + ")."));
                            }
                            var cleanClose = opened === false || typeof (ev.wasClean) === "undefined" || ev.wasClean === true;
                            if (!cleanClose) {
                                var errorMessage = "Unclean disconnect from socket: " + (ev.reason || "[no reason given].");
                                _this.logger.warn(errorMessage, ev);
                                _this._sink.transportError(new Error(errorMessage));
                            }
                            if (typeof _this._onClose === "function") {
                                //called from close();
                                _this._onClose(cleanClose);
                            }
                            else {
                                //reconnect?
                                if (_this.connectionLost) {
                                    _this.connectionLost(_this);
                                }
                            }
                        };
                        socket.onmessage = function (ev) {
                            var messageData = ev.data;
                            if (typeof messageData === 'string') {
                                messageData = JSON.parse(ev.data);
                            }
                            _this.logger.log('onmessage', messageData);
                            _this._sink.handleMessage(_this, messageData);
                        };
                        _this._socket = socket;
                    });
                };
                Transport.prototype.close = function () {
                    var _this = this;
                    this.logger.log('close called on transport');
                    if (this._onClose !== null && this._onClose !== undefined) {
                        this.logger.warn('close called twice.');
                    }
                    if (this._socket == null) {
                        this.logger.log('No Socket created.');
                        if (this._state !== TransportState.Closed) {
                            this._state = TransportState.Closed;
                        }
                        return Promise.resolve(true);
                    }
                    if (this._socket.readyState === SocketState.CLOSED) {
                        this.logger.log('Socket already closed.');
                        this._socket = null;
                        if (typeof this._onClose === "function") {
                            //should never happen.
                            this.logger.warn('Possible unresolved _onClose promise.');
                        }
                        return Promise.resolve(false);
                    }
                    return new Promise(function (resolve) {
                        _this._onClose = function (cleanClose) {
                            delete _this._onClose;
                            _this._socket = null;
                            resolve(cleanClose);
                        };
                        _this._socket.close();
                    });
                };
                return Transport;
            }());
            exports_3("Transport", Transport);
        }
    }
});
System.register("connection", ["url", "config", "logging"], function(exports_4, context_4) {
    "use strict";
    var __moduleName = context_4 && context_4.id;
    var url_1, config_1, logging_2;
    var ConnectionMonitor, ConnectionState, stateLookup, Connection;
    return {
        setters:[
            function (url_1_1) {
                url_1 = url_1_1;
            },
            function (config_1_1) {
                config_1 = config_1_1;
            },
            function (logging_2_1) {
                logging_2 = logging_2_1;
            }],
        execute: function() {
            ConnectionMonitor = (function () {
                function ConnectionMonitor(connection) {
                    this.connection = connection;
                    this.logger = logging_2.getLogger(connection);
                }
                ConnectionMonitor.prototype.markLastMessage = function () {
                };
                ConnectionMonitor.prototype.startMonitoring = function () {
                    var _this = this;
                    this.keepAliveTimeout = this.connection.timeouts.keepAliveTimeout * 1000;
                    var checkInterval = this.keepAliveTimeout / 3;
                    this.warnAfter = checkInterval * 2;
                    this._heartBeatInterval = setInterval(function () { return _this.checkKeepAlive(); }, checkInterval);
                    this.logger.log("Start monitoring keepAlive every " + checkInterval + "ms.");
                };
                ConnectionMonitor.prototype.stopMonitoring = function () {
                    clearInterval(this._heartBeatInterval);
                    this.logger.info('monitoring stopped');
                };
                ConnectionMonitor.prototype.checkKeepAlive = function () {
                    this.logger.log('checkKeepAlive');
                    if (this.connection.state !== ConnectionState.connected) {
                        return;
                    }
                    var lastReceived = Date.now() - this.connection.lastMessageReceived.getTime();
                    if (lastReceived > this.keepAliveTimeout) {
                        this.logger.warn('ConnectionMonitor: connection exceeded keepAlive timeout. Connection probably lost.');
                        this.connection.connectionLost();
                        return;
                    }
                    if (lastReceived > this.warnAfter) {
                        this.logger.warn('ConnectionMonitor: connection exceeded 2/3th of the keepAlive timeout. Connection probably slow.');
                        this.connection.slowConnection = true;
                    }
                    else {
                        this.connection.slowConnection = false;
                    }
                };
                return ConnectionMonitor;
            }());
            (function (ConnectionState) {
                ConnectionState[ConnectionState["connecting"] = 0] = "connecting";
                ConnectionState[ConnectionState["connected"] = 1] = "connected";
                ConnectionState[ConnectionState["reconnecting"] = 2] = "reconnecting";
                ConnectionState[ConnectionState["disconnected"] = 4] = "disconnected";
            })(ConnectionState || (ConnectionState = {}));
            exports_4("ConnectionState", ConnectionState);
            stateLookup = (_a = {},
                _a[ConnectionState.connecting] = "connecting",
                _a[ConnectionState.connected] = "connected",
                _a[ConnectionState.reconnecting] = "reconnecting",
                _a[ConnectionState.disconnected] = "disconnected",
                _a
            );
            Connection = (function () {
                function Connection(config) {
                    this.config = config;
                    this._state = ConnectionState.connecting;
                    this._slowConnection = false;
                    this.logger = logging_2.getLogger(this);
                    this.logSourceId = "Connection";
                    this.monitor = new ConnectionMonitor(this);
                    this.eventAggregator = new config_1.EventAggregator();
                    this.groupsToken = null;
                    this.timeouts = {
                        disconnectTimeout: 0,
                        keepAliveTimeout: 0,
                        transportConnectTimeout: 0
                    };
                    this._urlBuilder = new url_1.UrlBuilder(config.baseUrl);
                }
                /** @internal */
                Connection.prototype.markLastMessage = function () {
                    this.lastMessageReceived = new Date();
                    this.monitor.markLastMessage();
                };
                Object.defineProperty(Connection.prototype, "state", {
                    get: function () {
                        return this._state;
                    },
                    /** @internal */
                    set: function (newState) {
                        var oldState = this._state;
                        this._state = newState;
                        this.logger.log("State changed from " + stateLookup[oldState] + " to " + stateLookup[newState] + ".");
                        this.eventAggregator.publish('stateChanged', { oldState: oldState, newState: newState });
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(Connection.prototype, "logLevel", {
                    get: function () {
                        return this.logger.level;
                    },
                    set: function (value) {
                        logging_2.setLogLevel(this, value);
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(Connection.prototype, "transport", {
                    get: function () {
                        return this._transport;
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(Connection.prototype, "connectionToken", {
                    get: function () {
                        return this._connectionToken;
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(Connection.prototype, "url", {
                    get: function () {
                        return this._urlBuilder;
                    },
                    enumerable: true,
                    configurable: true
                });
                Object.defineProperty(Connection.prototype, "slowConnection", {
                    get: function () {
                        return this._slowConnection;
                    },
                    set: function (isSlowConnection) {
                        if (isSlowConnection && this._slowConnection === false) {
                            this.eventAggregator.publish('connectionSlow', this);
                        }
                        this._slowConnection = isSlowConnection;
                    },
                    enumerable: true,
                    configurable: true
                });
                /** @internal */
                Connection.prototype.connectionLost = function () {
                    this.eventAggregator.publish('connectionLost', this);
                    this.handleTransportConnectionLoss(this._transport);
                };
                Connection.prototype.setNegotiated = function (result) {
                    this._connectionToken = result.ConnectionToken;
                    this._connectionId = result.ConnectionId;
                    this.timeouts.disconnectTimeout = result.DisconnectTimeout;
                    this.timeouts.keepAliveTimeout = result.KeepAliveTimeout;
                    this.timeouts.transportConnectTimeout = result.TransportConnectTimeout;
                };
                Connection.prototype.handleTransportConnectionLoss = function (transport) {
                    if (this._transport === transport && this.state === ConnectionState.connected) {
                        this.logger.warn('Connection interrupted');
                        this.reconnect();
                    }
                };
                Connection.prototype.reconnect = function () {
                    var _this = this;
                    this.state = ConnectionState.reconnecting;
                    config_1.protocol.reconnect(this)
                        .then(function () {
                        _this.state = ConnectionState.connected;
                    })
                        .catch(function (e) {
                        _this.logger.warn('Failed to reconnect. Stopping connection.', e);
                        _this.stop();
                    });
                };
                /**
                  * Subscribe to incoming messages.
                  * @returns a dispose function. Calling this function will dispose the subscription.
                  */
                Connection.prototype.onMessage = function (handler) {
                    return this.eventAggregator.subscribe('message', handler);
                };
                /**
                  * Subscribe to state changes.
                  * @returns a dispose function. Calling this function will dispose the subscription.
                 */
                Connection.prototype.onStateChange = function (handler) {
                    return this.eventAggregator.subscribe('stateChanged', handler);
                };
                /** Send data to the server.
                 * @returns a promise which resolves when the data is send.
                 */
                Connection.prototype.send = function (data) {
                    return this._transport.send(data);
                };
                /** This method is used internally by the signalr client for handling incoming data.
                 * @internal
                */
                Connection.prototype.handleData = function (data) {
                    var _this = this;
                    this.eventAggregator.publish('datareceived', data);
                    var shouldReconnect = typeof (data.T) !== "undefined" && data.T === 1;
                    if (shouldReconnect) {
                        this.logger.info('Server says "You Should reconnect". So we try...');
                        this.reconnect();
                    }
                    if (typeof (data.G) !== "undefined") {
                        this.groupsToken = data.G;
                    }
                    if (Array.isArray(data.M)) {
                        data.M.forEach(function (message) {
                            return _this.eventAggregator.publish('message', message);
                        });
                    }
                };
                /**
                 * Starts the connection.
                 * @param {ConnectionConfig} options - Configuration for this connection.
                 * @returns a Promise of `this` which resolves when the connection is succesfully started.
                 */
                Connection.prototype.start = function (options) {
                    var _this = this;
                    this.config.validate();
                    return config_1.protocol.negotiate(this)
                        .then(function (result) {
                        _this.setNegotiated(result);
                        return config_1.protocol.connect(_this, result, options);
                    })
                        .then(function (transport) {
                        if (transport.supportsKeepAlive) {
                            _this.monitor.startMonitoring();
                        }
                        transport.connectionLost = function (t) { return _this.handleTransportConnectionLoss(t); };
                        _this._transport = transport;
                        return config_1.protocol.start(_this);
                    })
                        .then(function () {
                        _this.state = ConnectionState.connected;
                        //todo: support node with beforeExit?
                        window.addEventListener('unload', function () {
                            _this.stop();
                        });
                        return _this;
                    });
                };
                /**
                 * Starts the connection.
                 * @returns a Promise of `this` which resolves when the connection is stopped.
                 */
                Connection.prototype.stop = function () {
                    var _this = this;
                    if (this.state === ConnectionState.disconnected) {
                        this.logger.warn("Connection is already stopped.");
                        return;
                    }
                    this.logger.log('Connection: Stop.');
                    this.state = ConnectionState.disconnected;
                    var promise = config_1.protocol.abort(this);
                    this.monitor.stopMonitoring();
                    this._transport = null;
                    return promise.then(function () { return _this; });
                };
                return Connection;
            }());
            exports_4("Connection", Connection);
        }
    }
    var _a;
});
///<reference path="./_wire.d.ts" />
System.register("protocol", ["transport", "config", "logging"], function(exports_5, context_5) {
    "use strict";
    var __moduleName = context_5 && context_5.id;
    var transport_1, config_2, logging_3;
    var ProtocolHelper;
    function buildTransport(transport, connection) {
        var transportFactory = config_2.getTransportConfiguration(transport, connection.config);
        var url = connection.url;
        url.transport = transportFactory.name;
        var instance = new transport_1.Transport(transportFactory, connection);
        return instance;
    }
    function tryWithinTime(promise, timeout, log) {
        return new Promise(function (resolve, reject) {
            var timer = setTimeout(function () {
                log.warn('tryConnect: timeout');
                reject(new Error("Timeout: Could not initialize transport within " + timeout + "ms."));
            }, timeout);
            promise.then(function (r) {
                clearTimeout(timer);
                resolve(r);
            });
        });
    }
    function createTimeout(timeout) {
        return new Promise(function (resolve, reject) {
            var timer = setTimeout(function () { resolve(timeout); }, timeout);
        });
    }
    function tryConnect(nextTransportInLine, timeout, log) {
        var transport = nextTransportInLine();
        if (transport === null) {
            return Promise.reject(new Error('Could not connect to transport.'));
        }
        var timeoutPromise = createTimeout(timeout);
        var connectPromise = transport.connect(timeoutPromise)
            .then(function () { return waitForInitializedTransport(transport, timeoutPromise, log); })
            .then(function () { return transport; });
        return tryWithinTime(connectPromise, timeout, log)
            .catch(function (e) {
            log.warn("Failed to connect using " + transport.protocol + " transport.", e);
            return tryConnect(nextTransportInLine, timeout, log);
        });
    }
    function connectToFirstAvailable(transportOrder, connection, timeout) {
        var logger = logging_3.getLogger(connection);
        return tryConnect(function () {
            if (transportOrder.length === 0) {
                return null;
            }
            return buildTransport(transportOrder.shift(), connection);
        }, timeout, logger);
    }
    function waitForInitializedTransport(transport, timeoutPromise, log) {
        if (transport.state === transport_1.TransportState.Ready) {
            return Promise.resolve(true);
        }
        if (transport.state < transport_1.TransportState.Ready) {
            return new Promise(function (resolve, reject) {
                var initialized = false;
                var oninit = transport.oninit = function (ev) { return handleInitEvent(ev); };
                timeoutPromise.then(function (timeout) {
                    if (initialized) {
                        return;
                    }
                    log.warn('waitForInit: timeout');
                    handleInitEvent(new Error("Timout: Could not initialize transport within " + timeout + "ms."));
                });
                function handleInitEvent(ev) {
                    if (initialized) {
                        return;
                    }
                    initialized = true;
                    if (transport.oninit === oninit) {
                        delete transport.oninit;
                    }
                    if (ev.correlationId) {
                        resolve();
                    }
                    else {
                        reject(ev);
                        transport.close();
                    }
                }
            });
        }
        return Promise.reject(new Error('Transport closed before init was received.'));
    }
    return {
        setters:[
            function (transport_1_1) {
                transport_1 = transport_1_1;
            },
            function (config_2_1) {
                config_2 = config_2_1;
            },
            function (logging_3_1) {
                logging_3 = logging_3_1;
            }],
        execute: function() {
            ProtocolHelper = (function () {
                function ProtocolHelper() {
                }
                ProtocolHelper.prototype.negotiate = function (connection) {
                    var url = connection.url;
                    var negotiateUrl = url.negotiate();
                    var http = connection.config.http;
                    return http.get(negotiateUrl)
                        .then(function (negotiationResult) {
                        url.connectionId = negotiationResult.ConnectionId;
                        url.connectionToken = negotiationResult.ConnectionToken;
                        url.appRelativeUrl = negotiationResult.Url;
                        return negotiationResult;
                    });
                };
                ProtocolHelper.prototype.reconnect = function (connection) {
                    var disconnectTimeout = connection.timeouts.disconnectTimeout * 1000;
                    logging_3.getLogger(connection).log("reconnecting (Timeout is " + String(disconnectTimeout) + "ms).");
                    var reconnectTimeout = createTimeout(disconnectTimeout);
                    return connection.transport.close()
                        .then(function () { return connection.transport.connect(reconnectTimeout, true); });
                };
                ProtocolHelper.prototype.connect = function (connection, negotiationResult, options) {
                    if (options === void 0) { options = {}; }
                    var url = connection.url;
                    var transportInitialized = false;
                    var timeout = negotiationResult.TransportConnectTimeout * 1000;
                    var transports = connection.config.transportOrder.slice();
                    if (false === negotiationResult.TryWebSockets) {
                        var websocketsIndex = transports.indexOf('websockets');
                        if (websocketsIndex >= 0) {
                            transports.splice(websocketsIndex, 1);
                        }
                    }
                    if (transports.length < 1) {
                        return Promise.reject(new Error("No transport configured. Supported transports: " + Object.keys(null) + " (Server supports WebSockets: " + negotiationResult.TryWebSockets + ")."));
                    }
                    return connectToFirstAvailable(transports, connection, timeout);
                };
                ProtocolHelper.prototype.start = function (connection) {
                    var startUrl = connection.url.start();
                    var http = connection.config.http;
                    return http.get(startUrl)
                        .then(function (response) {
                        if (typeof (response) !== "object" || response === null || response.Response !== "started") {
                            throw new Error('Start not succeeded');
                        }
                        logging_3.getLogger(connection).log('start success');
                    });
                };
                ProtocolHelper.prototype.abort = function (connection) {
                    var abortUrl = connection.url.abort();
                    var http = connection.config.http;
                    connection.transport.close();
                    return http.post(abortUrl, null);
                };
                return ProtocolHelper;
            }());
            exports_5("ProtocolHelper", ProtocolHelper);
        }
    }
    var _a;
});
System.register("http", [], function(exports_6, context_6) {
    "use strict";
    var __moduleName = context_6 && context_6.id;
    var FetchHttpClient;
    return {
        setters:[],
        execute: function() {
            FetchHttpClient = (function () {
                function FetchHttpClient() {
                    if (typeof fetch === 'undefined') {
                        throw new Error('cannot find fetch which is required by the FetchHttpClient');
                    }
                }
                /** Shorthand for a fetch request with method 'POST'. */
                FetchHttpClient.prototype.post = function (url, formData) {
                    var requestInit = { method: 'POST', body: formData };
                    return fetch(url, requestInit)
                        .then(function (r) { return r.json(); });
                };
                /** Shorthand for a fetch request with method 'GET'. */
                FetchHttpClient.prototype.get = function (url) {
                    return fetch(url)
                        .then(function (r) { return r.json(); });
                };
                return FetchHttpClient;
            }());
            exports_6("FetchHttpClient", FetchHttpClient);
        }
    }
    var _a;
});
System.register("EventAggregator", [], function(exports_7, context_7) {
    "use strict";
    var __moduleName = context_7 && context_7.id;
    var EventAggregator;
    return {
        setters:[],
        execute: function() {
            EventAggregator = (function () {
                function EventAggregator() {
                    this.eventLookup = {};
                }
                Object.defineProperty(EventAggregator.prototype, "hasAnySubscriptions", {
                    get: function () {
                        return Object.keys(this.eventLookup).length > 0;
                    },
                    enumerable: true,
                    configurable: true
                });
                EventAggregator.prototype.publish = function (eventName, payload) {
                    if (typeof eventName !== 'string') {
                        throw new Error('eventName must be of type string.');
                    }
                    var callbacks = this.eventLookup[eventName];
                    if (callbacks) {
                        callbacks.forEach(function (cb) {
                            try {
                                cb(payload, eventName);
                            }
                            catch (e) {
                            }
                        });
                    }
                };
                /**
                 * Subscribe to a event.
                 */
                EventAggregator.prototype.subscribe = function (eventName, callback) {
                    if (typeof eventName !== 'string') {
                        throw new Error('eventName must be of type string.');
                    }
                    if (typeof callback !== 'function') {
                        throw new Error('callback must be of type function.');
                    }
                    var eventLookup = this.eventLookup;
                    var subscriptions = eventLookup[eventName] || (eventLookup[eventName] = []);
                    subscriptions.push(callback);
                    return {
                        dispose: function () {
                            var id = subscriptions.indexOf(callback);
                            if (id !== -1) {
                                subscriptions.splice(id, 1);
                            }
                            if (subscriptions.length < 1) {
                                //remove empty subscriptions array.
                                delete eventLookup[eventName];
                            }
                        }
                    };
                };
                return EventAggregator;
            }());
            exports_7("EventAggregator", EventAggregator);
        }
    }
    var _a;
});
System.register("config", ["protocol", "http", "EventAggregator", "logging"], function(exports_8, context_8) {
    "use strict";
    var __moduleName = context_8 && context_8.id;
    var protocol_1, http_1;
    var protocol, defaultHttpClient, transportLookup, defaultTransportOrder, Configuration;
    function registerTransport(transportFactory) {
        var name = transportFactory.transportName.toLowerCase();
        if (defaultTransportOrder.indexOf(name) >= 0) {
            return;
        }
        defaultTransportOrder.push(name);
        transportLookup[name] = transportFactory;
    }
    exports_8("registerTransport", registerTransport);
    function getTransport(name) {
        name = name.toLowerCase();
        if (transportLookup[name]) {
            return transportLookup[name];
        }
        return null;
    }
    exports_8("getTransport", getTransport);
    function getTransportConfiguration(transport, configuration) {
        var configConstructor;
        if (typeof transport === "string") {
            configConstructor = getTransport(transport);
        }
        else {
            configConstructor = transport;
        }
        return new configConstructor(configuration);
    }
    exports_8("getTransportConfiguration", getTransportConfiguration);
    function initializeDefaultConfiguration() {
        var configuration = new Configuration();
        configuration.baseUrl = '/signalr';
        configuration.setTransportOrder(defaultTransportOrder);
        configuration.http = defaultHttpClient;
        return configuration;
    }
    exports_8("initializeDefaultConfiguration", initializeDefaultConfiguration);
    return {
        setters:[
            function (protocol_1_1) {
                protocol_1 = protocol_1_1;
            },
            function (http_1_1) {
                http_1 = http_1_1;
            },
            function (EventAggregator_1_1) {
                exports_8({
                    "EventAggregator": EventAggregator_1_1["EventAggregator"]
                });
            },
            function (logging_4_1) {
                exports_8({
                    "setDefaultLogLevel": logging_4_1["setDefaultLogLevel"]
                });
            }],
        execute: function() {
            /** @internal */
            exports_8("protocol", protocol = new protocol_1.ProtocolHelper());
            exports_8("defaultHttpClient", defaultHttpClient = new http_1.FetchHttpClient());
            transportLookup = {};
            defaultTransportOrder = [];
            Configuration = (function () {
                function Configuration() {
                }
                Object.defineProperty(Configuration.prototype, "transportOrder", {
                    get: function () {
                        return this._transports;
                    },
                    enumerable: true,
                    configurable: true
                });
                Configuration.prototype.setTransportOrder = function (value) {
                    var newArray = [];
                    if (Array.isArray(value)) {
                        value.forEach(function (t) {
                            var name = t.toLowerCase();
                            if (defaultTransportOrder.indexOf(name) >= 0) {
                                newArray.push(name);
                            }
                            else {
                                throw new Error("Transport " + t + " is not supported.");
                            }
                        });
                    }
                    if (newArray.length === 0) {
                        throw new Error('Please provide an array with at least 1 transport');
                    }
                    this._transports = newArray;
                    return this;
                };
                Configuration.prototype.validate = function () {
                    if (this.http == null) {
                        throw new Error("Configuration Error: No http configured.");
                    }
                    if (typeof this.baseUrl !== "string") {
                        throw new Error("Configuration Error: baseUrl is invalid.");
                    }
                    if (this._transports.length <= 0) {
                        throw new Error("Configuration Error: no transports configured.");
                    }
                };
                return Configuration;
            }());
            exports_8("Configuration", Configuration);
        }
    }
    var _a;
});
System.register("hubs", ["connection", "config"], function(exports_9, context_9) {
    "use strict";
    var __moduleName = context_9 && context_9.id;
    var connection_1, config_3;
    var HubConnection, HubProxy;
    function isHubInvocationResult(data) {
        return typeof data['I'] !== "undefined";
    }
    function isErrorResult(result) {
        return typeof result['E'] !== "undefined";
    }
    return {
        setters:[
            function (connection_1_1) {
                connection_1 = connection_1_1;
            },
            function (config_3_1) {
                config_3 = config_3_1;
            }],
        execute: function() {
            HubConnection = (function (_super) {
                __extends(HubConnection, _super);
                function HubConnection(config) {
                    _super.call(this, config);
                    this.messageId = 0;
                    this._hubs = {};
                    this._pendingInvocations = {};
                }
                Object.defineProperty(HubConnection.prototype, "hubNames", {
                    get: function () {
                        return Object.keys(this._hubs);
                    },
                    enumerable: true,
                    configurable: true
                });
                /**
                 * Get a reference to a hub proxy.
                 * @param {string} name - The name of the hub.
                 */
                HubConnection.prototype.hub = function (name) {
                    var lcaseName = name.toLowerCase();
                    if (false === this._hubs.hasOwnProperty(lcaseName)) {
                        if (this.state === connection_1.ConnectionState.connected || this.state === connection_1.ConnectionState.reconnecting) {
                            throw new Error('Cannot register hub after de connecting has been started.');
                        }
                        this._hubs[lcaseName] = new HubProxy(name, this, this.logger);
                    }
                    return this._hubs[lcaseName];
                };
                /** Register multiple hubs at once.
                 * @returns an array of HubProxy instances.
                 */
                HubConnection.prototype.registerHubs = function () {
                    var _this = this;
                    var names = [];
                    for (var _i = 0; _i < arguments.length; _i++) {
                        names[_i - 0] = arguments[_i];
                    }
                    return names.map(function (hub) { return _this.hub(hub); });
                };
                /**
                 * @internal
                 */
                HubConnection.prototype.handleData = function (data) {
                    var _this = this;
                    this.logger.log('handle hub data', data);
                    if (isHubInvocationResult(data)) {
                        this.handleInvocationResult(data);
                        return;
                    }
                    else {
                        if (typeof data['M'] !== "undefined") {
                            var messages = (data).M;
                            messages.forEach(function (msg) {
                                var hubName = msg.H.toLowerCase();
                                var method = msg.M;
                                if (hubName in _this._hubs) {
                                    var proxy = _this._hubs[hubName];
                                    proxy.trigger(method, msg.A, msg.S);
                                }
                                else {
                                    _this.logger.warn("No proxy for hub '" + hubName + "' to invoke method '" + method + "' on.");
                                }
                            });
                            //prevent double handling of messages by the connection;
                            delete data['M'];
                        }
                        //let the base connection handle the generic stuff like groups, etc.
                        _super.prototype.handleData.call(this, data);
                    }
                };
                /**
                 * Starts the hub connection and registers hubs with at least one client event subscription.
                 * @returns a promise which resolves when the connection is started.
                 */
                HubConnection.prototype.start = function () {
                    var _this = this;
                    var activeHubs = this.hubNames
                        .filter(function (hubName) { return _this._hubs[hubName].hasEventHandlers; });
                    (_a = this.url).setHubs.apply(_a, activeHubs);
                    return _super.prototype.start.call(this);
                    var _a;
                };
                /**
                 * Stops the hub connection and rejects all pending invoications.
                 * @returns a promise which resolves when the connection is stopped.
                 */
                HubConnection.prototype.stop = function () {
                    var _this = this;
                    var stopPromise = _super.prototype.stop.call(this);
                    Object.keys(this._pendingInvocations).forEach(function (key) {
                        _this._pendingInvocations[key].reject(new Error('Connection is being stopped.'));
                        delete _this._pendingInvocations[key];
                    });
                    return stopPromise;
                };
                HubConnection.prototype.invokeHubMethod = function (hubOrhubName, method) {
                    var _this = this;
                    var args = [];
                    for (var _i = 2; _i < arguments.length; _i++) {
                        args[_i - 2] = arguments[_i];
                    }
                    var id = this.messageId++;
                    var invocation = {
                        "H": null,
                        "M": method,
                        "A": args || [],
                        "I": id };
                    var hub;
                    if (typeof hubOrhubName === "string") {
                        invocation.H = hubOrhubName;
                    }
                    else {
                        hub = hubOrhubName;
                        invocation.H = hub.name;
                        if (typeof hub.state !== "undefined" && hub.state !== null) {
                            invocation.S = hub.state;
                        }
                    }
                    return new Promise(function (resolve, reject) {
                        _this._pendingInvocations[id] = {
                            resolve: resolve, reject: reject, hub: hub
                        };
                        _super.prototype.send.call(_this, invocation)
                            .catch(function (e) {
                            _this.logger.warn("Error sending hub method invocation with id " + id + ".", e);
                            delete _this._pendingInvocations[id];
                            reject(e);
                        });
                    });
                };
                /**
                 * @internal
                 */
                HubConnection.prototype.handleInvocationResult = function (result) {
                    var invocationId = result.I;
                    var pendingInvocation = this._pendingInvocations[invocationId];
                    if (result.P) {
                        this.logger.log('Progress messages are not supported. Skip hub response.');
                        return;
                    }
                    if (!pendingInvocation) {
                        this.logger.warn("Invoication with id " + invocationId + " not found.");
                        return;
                    }
                    delete this._pendingInvocations[invocationId];
                    if ((typeof result.S !== "undefined") && (typeof pendingInvocation.hub === "object")) {
                        pendingInvocation.hub.extendState(result.S);
                    }
                    if (isErrorResult(result)) {
                        if (result.T) {
                            //stacktrace
                            this.logger.error("HubInvocationErrorResult '" + result.E + "'. Stack trace:\n" + result.T);
                        }
                        var error = new Error(result.E);
                        error['source'] = result.H ? "HubException" : "Exception";
                        error['data'] = result.D;
                        pendingInvocation.reject(error);
                    }
                    else {
                        this.logger.log("Hub method invocation " + result.I + " completed with result: " + (result.R || '<void>'));
                        pendingInvocation.resolve(result.R);
                    }
                };
                return HubConnection;
            }(connection_1.Connection));
            exports_9("HubConnection", HubConnection);
            HubProxy = (function () {
                function HubProxy(name, connection, logger) {
                    this.name = name;
                    this.connection = connection;
                    this.logger = logger;
                    this._eventAggregator = new config_3.EventAggregator();
                }
                /** Invokes a method on the server.
                 * @param method - The method to invoke.
                 * @param args - The method arguments.
                 * @returns a promise which resolves when the method is succesfully invoked at the server.
                 */
                HubProxy.prototype.invoke = function (method) {
                    var args = [];
                    for (var _i = 1; _i < arguments.length; _i++) {
                        args[_i - 1] = arguments[_i];
                    }
                    return (_a = this.connection).invokeHubMethod.apply(_a, [this, method].concat(args));
                    var _a;
                };
                /** Registers an event handler for a client side event, invoked by the server.
                 * @param method - The method to register the callback for.
                 * @param callback - The callback to handle the event.
                 * @returns an object with a dispose method to unregister the event handler.
                 */
                HubProxy.prototype.on = function (method, callback) {
                    return this._eventAggregator.subscribe(method.toLowerCase(), callback);
                };
                /** This method is used by the hubConnection to invoke a client side event.
                 * @internal
                 */
                HubProxy.prototype.trigger = function (method, args, state) {
                    this.logger.log("Hub '" + this.name + "': trigger method '" + method + "' (" + args.length + " arguments).", args);
                    this.extendState(state);
                    this._eventAggregator.publish(method.toLowerCase(), args);
                };
                Object.defineProperty(HubProxy.prototype, "hasEventHandlers", {
                    get: function () {
                        return this._eventAggregator.hasAnySubscriptions;
                    },
                    enumerable: true,
                    configurable: true
                });
                HubProxy.prototype.extendState = function (state) {
                    var _this = this;
                    if (typeof (state) !== "object" || state === null) {
                        return;
                    }
                    if (typeof this.state === "undefined" || this.state === null) {
                        this.state = {};
                    }
                    Object.keys(state).forEach(function (key) {
                        _this.state[key] = state[key];
                    });
                };
                return HubProxy;
            }());
            exports_9("HubProxy", HubProxy);
        }
    }
    var _a;
});
System.register("transport-websocket", [], function(exports_10, context_10) {
    "use strict";
    var __moduleName = context_10 && context_10.id;
    var webSockets;
    function transformSend(data) {
        var payload = typeof (data) === "string" ? data : JSON.stringify(data);
        return payload;
    }
    return {
        setters:[],
        execute: function() {
            webSockets = (function () {
                function webSockets() {
                    this.name = webSockets.transportName;
                    this.supportsKeepAlive = true;
                }
                webSockets.prototype.connectSocket = function (uri, reconnect, transport, log) {
                    return new WebSocket(uri.connect(reconnect));
                };
                webSockets.prototype.createSendTransformer = function () {
                    return transformSend;
                };
                webSockets.transportName = "webSockets";
                return webSockets;
            }());
            exports_10("default", webSockets);
        }
    }
    var _a;
});
System.register("transport-longpolling", [], function(exports_11, context_11) {
    "use strict";
    var __moduleName = context_11 && context_11.id;
    var SocketState, PollSocket, reconnectCounter, longPolling;
    function noop() { }
    function createEvent(name) {
        try {
            return new Event(name);
        }
        catch (e) {
            // Internet Explorer doesn't support the Event constructor.
            // Simple try catch because this is not in our hot path.
            var event_1 = document.createEvent('Event');
            event_1.initEvent(name, false, false);
            return event_1;
        }
    }
    function transformSend(data) {
        var payload = typeof (data) === "string" ? data : JSON.stringify(data);
        return payload;
    }
    return {
        setters:[],
        execute: function() {
            (function (SocketState) {
                SocketState[SocketState["Opening"] = 0] = "Opening";
                SocketState[SocketState["Opened"] = 1] = "Opened";
                SocketState[SocketState["Closed"] = 2] = "Closed";
            })(SocketState || (SocketState = {}));
            PollSocket = (function () {
                function PollSocket(url, lastMessageId, http, log) {
                    this.url = url;
                    this.http = http;
                    this.log = log;
                    this.readyState = SocketState.Opening;
                    this.onopen = null;
                    this.onclose = null;
                    this.onmessage = null;
                    this.onerror = null;
                    this._lastMessageId = lastMessageId;
                }
                PollSocket.prototype.handlePollResponse = function (responseBody) {
                    var _this = this;
                    this._lastMessageId = responseBody.C;
                    this.onmessage({ data: responseBody });
                    if (typeof responseBody.L === "number") {
                        //Long Poll Delay is set 
                        this._pollTimeout = setTimeout(function () { return _this.poll(); }, responseBody.L);
                    }
                    else {
                        this.poll();
                    }
                };
                PollSocket.prototype.poll = function () {
                    var _this = this;
                    this.log.log('polling...');
                    var url = this.url.poll(this._lastMessageId);
                    if (this.readyState !== SocketState.Opened) {
                        this.log.log('socket closed.', this.readyState);
                        return Promise.reject(new Error('socket closed.'));
                    }
                    var promise = this.http.get(url);
                    promise.catch(function (e) {
                        _this.onerror(e);
                        _this._close(false);
                    });
                    promise.then(function (r) {
                        _this.log.log('poll result', r);
                        _this.handlePollResponse(r);
                    });
                    return promise;
                };
                PollSocket.prototype.connect = function (reconnectCount) {
                    var _this = this;
                    var isReconnecting = reconnectCount > 0;
                    var connectUrl = this.url.connect(isReconnecting);
                    this.log.log('Polling. Connecting to ' + connectUrl);
                    var formdata = new FormData();
                    formdata.append('transport', this.url.transport);
                    formdata.append('clientProtocol', '1.5');
                    formdata.append('connectionToken', this.url.connectionToken);
                    formdata.append('connectionData', decodeURIComponent(this.url.connectionData));
                    if (this._lastMessageId) {
                        formdata.append('messageId', this._lastMessageId);
                    }
                    var promise = (isReconnecting ?
                        this.http.post(connectUrl, formdata) :
                        this.http.get(connectUrl));
                    promise.then(function (responseBody) {
                        if (!isReconnecting) {
                            if (_this.readyState !== SocketState.Opening) {
                                _this.log.log('Connect failed. ReadyState is not Opening but is: ' + _this.readyState);
                                return;
                            }
                            if (typeof (responseBody.S) !== "number") {
                                //it is possible to receive messages before init request is received.
                                _this.log.warn('Expected S property on first server response.');
                            }
                        }
                        if (!isReconnecting || _this.readyState !== SocketState.Opened) {
                            //the _reconnectTimeout could fire before this request is handled.
                            _this.fireOpened();
                        }
                        _this.handlePollResponse(responseBody);
                    });
                    clearTimeout(this._reconnectTimeout);
                    if (isReconnecting) {
                        //long polling will change state from reconnecting to connecting before the connect request returns.
                        //some heuristic is in place to increase the delay for reconnected events when the requests repeately fails.
                        var reconnectHeuristic = Math.min(1000 * (Math.pow(2, reconnectCount) - 1), 1000 * 60 * 60);
                        this._reconnectTimeout = setTimeout(function () { return _this.fireOpened(); }, reconnectHeuristic);
                    }
                    promise.catch(function (e) {
                        _this.log.warn('error while connecting longPolling', e);
                        _this._close(false);
                    });
                    return promise;
                };
                PollSocket.prototype.fireOpened = function () {
                    this.readyState = SocketState.Opened;
                    clearTimeout(this._reconnectTimeout);
                    this.onopen(createEvent("OpenEvent"));
                };
                PollSocket.prototype._close = function (wasClean, code, reason) {
                    this.readyState = SocketState.Closed;
                    clearTimeout(this._pollTimeout);
                    delete this._pollTimeout;
                    clearTimeout(this._reconnectTimeout);
                    delete this._reconnectTimeout;
                    if (typeof this.onclose === "function") {
                        this.onclose({ wasClean: wasClean, code: code, reason: reason });
                    }
                };
                PollSocket.prototype.close = function (code, reason) {
                    this._close(true, code, reason);
                };
                PollSocket.prototype.send = function (data) {
                    var _this = this;
                    if (this.readyState !== SocketState.Opened) {
                        return Promise.reject(new Error('Invalid State'));
                    }
                    var url = this.url.send();
                    var body = null;
                    if (typeof (data) === "string" || typeof data === "undefined" || data === null) {
                        body = data;
                    }
                    else {
                        body = JSON.stringify(data);
                    }
                    var formdata = new FormData();
                    formdata.append('data', body);
                    return this.http.post(url, formdata)
                        .then(function (response) { return _this.onmessage({ data: response }); });
                };
                return PollSocket;
            }());
            reconnectCounter = '__reconnectCount';
            longPolling = (function () {
                function longPolling(configuration) {
                    this.configuration = configuration;
                    //name = longPolling.name;
                    this.name = longPolling.transportName;
                    this.supportsKeepAlive = false;
                }
                longPolling.prototype.connectSocket = function (uri, reconnect, transport, log) {
                    var socket = new PollSocket(uri, transport.lastMessageId, this.configuration.http, log);
                    var reconnectCount = transport[reconnectCounter];
                    if (typeof reconnectCount !== 'number') {
                        transport[reconnectCounter] = reconnectCount = 0;
                    }
                    if (reconnect) {
                        transport[reconnectCounter] = ++reconnectCount;
                        log.log("Reconnecting longPolling socket. Reconnect count: " + reconnectCount + ".");
                    }
                    socket.connect(reconnectCount)
                        .then(function () {
                        transport[reconnectCounter] = 0;
                    });
                    return socket;
                };
                longPolling.prototype.createSendTransformer = function () {
                    return function (x) { return x; };
                };
                longPolling.transportName = "longPolling";
                return longPolling;
            }());
            exports_11("default", longPolling);
        }
    }
    var _a;
});
System.register("index", ["connection", "hubs", "config", "transport-websocket", "transport-longpolling"], function(exports_12, context_12) {
    "use strict";
    var __moduleName = context_12 && context_12.id;
    var connection_2, hubs_1, config, transport_websocket_1, transport_longpolling_1;
    function hubConnection(path, hubs) {
        if (path === void 0) { path = '/signalr'; }
        if (hubs === void 0) { hubs = []; }
        var connectionConfig = config.initializeDefaultConfiguration();
        connectionConfig.baseUrl = path;
        var connection = new hubs_1.HubConnection(connectionConfig);
        connection.registerHubs.apply(connection, hubs);
        return connection;
    }
    exports_12("hubConnection", hubConnection);
    function persistentConnection(path) {
        if (typeof path !== "string") {
            throw new Error('please provide a path');
        }
        var connectionConfig = config.initializeDefaultConfiguration();
        connectionConfig.baseUrl = path;
        return new connection_2.Connection(connectionConfig);
    }
    exports_12("persistentConnection", persistentConnection);
    return {
        setters:[
            function (connection_2_1) {
                connection_2 = connection_2_1;
            },
            function (hubs_1_1) {
                hubs_1 = hubs_1_1;
            },
            function (config_4) {
                config = config_4;
            },
            function (transport_websocket_1_1) {
                transport_websocket_1 = transport_websocket_1_1;
            },
            function (transport_longpolling_1_1) {
                transport_longpolling_1 = transport_longpolling_1_1;
            }],
        execute: function() {
            config.registerTransport(transport_websocket_1.default);
            config.registerTransport(transport_longpolling_1.default);
            exports_12("config", config);
            exports_12("Connection", connection_2.Connection);
            exports_12("HubConnection", hubs_1.HubConnection);
        }
    }
    var _a;
});

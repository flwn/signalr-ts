
type logMethod = (msg: string, ...optionalParams: any[]) => void;


export enum LogLevel {
    Off = 0,
    Errors = 1,
    Warnings = 2,
    Info = 3,
    Debug = 4,
    All = Number.MAX_VALUE,
}

var defaultLogLevel = LogLevel.Off;

export interface Logger {
    error(msg: string, ...optionalParams: any[]): void;
    info(msg: string, ...optionalParams: any[]): void;
    warn(msg: string, ...optionalParams: any[]): void;
    log(msg: string, ...optionalParams: any[]): void;

    level: LogLevel;
}

export interface LogSource {
    logSourceId: string;
}

const LoggerKey = '__loglevel';

export function getLogger(source: LogSource): Logger {
    if (typeof source !== "object" || source === null) {
        throw new Error('Invalid log source');
    }

    if (!source[LoggerKey]) {
        source[LoggerKey] = new ConsoleLogger()
    }

    return source[LoggerKey];
}

export function setLogLevel(source: LogSource, level: LogLevel) {

    if (typeof level !== "number") {
        throw new Error('level must be a number');
    }
    let logger = getLogger(source);
    logger.level = level;
}

export function setDefaultLogLevel(level: LogLevel) {
    if (typeof (level) !== "number") {
        throw new Error('LogLevel must be a number');
    }
    defaultLogLevel = level;
}


function noop() { }

function logToConsole(level: string, message: string, ...optionalParams: any[]) {
    let formattedMessage = `[${new Date().toTimeString()}] SignalR-ts: ${message}`;
    console[level](formattedMessage, ...optionalParams);
}


class ConsoleLogger implements Logger {

    private _level: LogLevel = defaultLogLevel;

    constructor() {
        this.initLoggers();
    }

    error: logMethod;
    warn: logMethod;
    info: logMethod;
    log: logMethod;

    get level(): LogLevel {
        return this._level;
    }

    set level(value: LogLevel) {
        this._level = value;
        this.initLoggers();
    }


    private initLoggers() {
        let level = this._level;
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
    }
}


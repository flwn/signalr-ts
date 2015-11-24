
export enum DeferredState {
    pending,
    resolved,
    rejected
}

export class Deferred<T> {
    private _promise: Promise<T>;
    private _resolver: (value: T) => void;
    private _rejector: (reason?: any) => void;
    private _state: DeferredState = DeferredState.pending;

    constructor() {
        this._promise = new Promise((resolve: (value: T) => void, reject: (reason?: any) => void) => {
            this._resolver = resolve;
            this._rejector = reject;
        });
    }

    resolve(value?: T): boolean {
        if (this._state !== DeferredState.pending) {
            return false;
        }
        this._state = DeferredState.resolved;
        this._resolver(value);
        return true;
    }

    reject(reason?: any): boolean {
        if (this._state !== DeferredState.pending) {
            return false;
        }
        this._state = DeferredState.rejected;
        this._rejector(reason);
        return true;
    }

    get promise(): Promise<T> {
        return this._promise;
    }

    get state(): DeferredState {
        return this._state;
    }
}
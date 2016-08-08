
/**
 * This class is a simple api for firing XMLHttpRequests. This one implements the get and post methods using the fetch api.
 */
export class FetchHttpClient {
    constructor() {
        if(typeof fetch === 'undefined') {
            throw new Error('cannot find fetch which is required by the FetchHttpClient');
        }
    }
    
    /** Shorthand for a fetch request with method 'POST'. */
    post<TResponse>(url: string, formData?: FormData): Promise<TResponse> {
        let requestInit = { method: 'POST', body: formData };
        
        return fetch(url, requestInit)
            .then(r => r.json<TResponse>());
    }
    
    /** Shorthand for a fetch request with method 'GET'. */
    get<TResponse>(url: string): Promise<TResponse> {
        
        return fetch(url)
            .then(r => r.json<TResponse>());
    }
    
}

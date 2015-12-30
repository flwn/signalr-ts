///<reference path="../typings/whatwg-fetch/whatwg-fetch.d.ts" />
import 'fetch';



export class HttpClient {
    
    post<TResponse>(url: string, formData?: FormData): Promise<TResponse> {
        let requestInit = { method: 'POST', body: formData };
        
        return this.fetch(url, requestInit)
            .then(r => r.json<TResponse>());
    }
    
    get<TResponse>(url: string): Promise<TResponse> {
        
        return this.fetch(url)
            .then(r => r.json<TResponse>());
    }
    
	fetch(url: string|Request, init?: RequestInit): Promise<Response> {
        return fetch(url, init);
    }
    
}
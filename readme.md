#signalr-ts
Signalr-ts is a signalr client library written in TypeScript with 'no' third-party library dependencies (except for polyfills). 

Currently two transports are **supported: WebSockets and LongPolling**. Support for Forever Frame and Server Sent Events is not yet planned, maybe it will sometime in the future.

Only dynamic hu  proxies are supported. I'd like to support dynamically generated proxies in the future. They are, however, tightly coupled to the jQuery version of the JavaScript client.

##Todo:

* Documentation
 * Description of api
 * Examples
 * Create quick start examples. 
* Unit tests
* Build scripts for ES5/ES6/AMD/SystemJS
* Implementation:
 * Implement ping
 * More resilient error handling.
 * More/better debug messages
* Design better api for startup and configuration
* Polishing the overall codebase
* Support CORS
* Profile app for possible memory leaks and other issues.

##Build
The build process of Signalr-ts not completely fleshed out. The goal is to provide several builds for systemjs, amd and stand alone. Right now only the SystemJS version is supported.

##Documentation
Virtually non-existant. My English is not very good, but I'll try to work it out in the near future :-)

##Dependencies
Written in TypeScript, tested with JSPM (see test/SignalrHost).

The [fetch api](https://fetch.spec.whatwg.org/) is used for XHR calls. A polyfill ([GitHub](https://github.com/github/fetch)) is needed for browsers which do not support the fetch api [Can I Use](http://caniuse.com/#search=fetch).

#Basic use

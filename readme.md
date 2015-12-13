#signalr-ts
Signalr-ts is a signalr client library written in TypeScript with 'no' third-party library dependencies (except for polyfills). 

##Todo:

* Documentation
* Unit tests
* Build scripts
* Implementation:
 * Implement reconnect
 * More resilient error handling.

##Build
The build process of Signalr-ts not completely fleshed out. The goal is to provide several builds for systemjs, amd and stand alone. Right now only the SystemJS version is supported.

##Documentation
Virtually non-existant. My English is not very good, but I'll try to work it out in the near future :-)

##Dependencies
Written in TypeScript, tested with JSPM (see test/SignalrHost).

The [fetch api](https://fetch.spec.whatwg.org/) is used for XHR calls. A polyfill ([GitHub](https://github.com/github/fetch)) is needed for browsers which do not support the fetch api [Can I Use](http://caniuse.com/#search=fetch).

#Basic use

SystemJS.config({
  browserConfig: {
    "baseURL": "/systemjs",
    "paths": {
      "signalrcore/": "src/"
    }
  },
  nodeConfig: {
    "paths": {
      "signalrcore/": ""
    }
  },
  packages: {
    "signalrcore": {
      "main": "signalrcore.js"
    }
  },
  meta: {

    "signalr/*": {
      "main": "signalr-ts.js",
      "format": "register",
      "exports": "signalr"
    }
  }
});

SystemJS.config({
  packageConfigPaths: [],
  map: {},
  packages: {}
});

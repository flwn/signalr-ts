System.config({
  baseURL: "/",
  defaultJSExtensions: true,
  transpiler: "typescript",
  paths: {
    "npm:*": "jspm_packages/npm/*",
    "github:*": "jspm_packages/github/*"
  },

  packages: {
    "/src": {
      "defaultExtension": "ts"
    },
    "/signalr-ts": {
      "defaultExtension": "ts"
    },
    "npm:*": {
      "defaultExtension": "js"
    },
    "github:*": {
      "defaultExtension": "js"
    }
  },

  map: {
    "fetch": "github:github/fetch@0.10.1",
    "typescript": "npm:typescript@1.7.3"
  }
});

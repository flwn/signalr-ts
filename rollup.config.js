export default {

  entry: 'dist/rollup/index.js',

  format: 'umd',
  moduleName: 'signalr',
  dest: 'dist/umd/signalr-ts.js', // equivalent to --output
  globals: {
    //'fetch': 'fetch'
  },
  external: ['fetch'
  ]
};
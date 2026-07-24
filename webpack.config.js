const path = require('node:path');

module.exports = {
  experiments: {
    asyncWebAssembly: true
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  module: {
    rules: [
      {
        test: /\.html\.j2$/,
        type: 'asset/source'
      }
    ]
  }
};

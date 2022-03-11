const path = require('path')

module.exports = {
  experiments: {
    outputModule: true
  },
  entry: {
    destination: './oneLiner.js',
    ImmersHUD: './webComponent.js',
    esm: {
      import: './index.js',
      library: {
        type: 'module'
      }
    }
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true
  },
  module: {
    parser: {
      javascript: { importMeta: false }
    },
    rules: [
      {
        test: /\.m?js$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: 'babel-loader'
        }
      },
      {
        test: /\.css$/i,
        use: ['css-loader']
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/i,
        type: 'asset/inline'
      },
      {
        test: /\.(html)$/i,
        type: 'asset/source'
      }
    ]
  }
}

const path = require('path')

module.exports = {
  entry: {
    destination: './oneLiner.js'
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true
  },
  module: {
    rules: [
      {
        test: /\.m?js$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              [
                '@babel/preset-env',
                {
                  targets: ['defaults', 'not ie 11'],
                  bugfixes: true,
                  useBuiltIns: 'usage',
                  corejs: '3.17',
                  shippedProposals: true,
                  debug: true
                }
              ]
            ]
          }
        }
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader']
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

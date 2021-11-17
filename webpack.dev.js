const { merge } = require('webpack-merge')
const common = require('./webpack.common.js')
const HtmlWebpackPlugin = require('html-webpack-plugin')

module.exports = merge(common, {
  mode: 'development',
  devtool: 'inline-source-map',
  devServer: {
    static: './dist',
    port: 8082,
    https: true
  },
  plugins: [
    new HtmlWebpackPlugin({
      title: 'One-liner test page',
      chunks: ['destination'],
      scriptLoading: 'module'
    }),
    new HtmlWebpackPlugin({
      title: 'Webcomponent test page',
      chunks: ['ImmersHUD'],
      scriptLoading: 'module',
      template: 'WebComponentTest.ejs',
      filename: 'webcomponent.html'
    })
  ]
})

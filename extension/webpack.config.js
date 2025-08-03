const webpack = require('webpack');
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Set paths
const SRC_DIR = path.resolve(__dirname, 'src');
const BUILD_DIR = path.resolve(__dirname, 'dist');

// Determine mode from environment or command line
const isProduction = process.env.NODE_ENV === 'production' || process.argv.includes('--mode=production') || process.argv.includes('production');
const mode = isProduction ? 'production' : 'development';

// Ensure build directory exists
if (!fs.existsSync(BUILD_DIR)) {
  fs.mkdirSync(BUILD_DIR, { recursive: true });
}

module.exports = {
  mode: mode,
  devtool: isProduction ? 'source-map' : 'cheap-module-source-map',
  entry: {
    popup: './src/popup/popup.js',
    content: './src/content/content.js',
    background: './src/background/background.js',
  },
  output: {
    path: BUILD_DIR,
    filename: '[name].bundle.js',
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
          },
        },
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  plugins: [
    new CleanWebpackPlugin({
      cleanOnceBeforeBuildPatterns: ['**/*'],
      cleanAfterEveryBuildPatterns: ['!manifest.json', '!assets/**/*'],
    }),
    new HtmlWebpackPlugin({
      template: './src/popup/popup.html',
      filename: 'popup.html',
      chunks: ['popup'],
      minify: isProduction,
    }),
    new webpack.DefinePlugin({
      'process.env.ALCHEMY_API_KEY': JSON.stringify(process.env.ALCHEMY_API_KEY || ''),
      'process.env.ETHERSCAN_MAINNET_API_KEY': JSON.stringify(process.env.ETHERSCAN_MAINNET_API_KEY || ''),
      'process.env.BACKEND_URL': JSON.stringify(process.env.BACKEND_URL || 'http://localhost:8000'),
      'process.env.NODE_ENV': JSON.stringify(mode)
    }),
    new CopyPlugin({
      patterns: [
        { 
          from: path.resolve(SRC_DIR, 'manifest.json'),
          to: path.resolve(BUILD_DIR, 'manifest.json'),
          toType: 'file',
          force: true,
          noErrorOnMissing: true
        },
        { 
          from: path.resolve(SRC_DIR, 'assets'),
          to: path.resolve(BUILD_DIR, 'assets'),
          noErrorOnMissing: true,
        },
      ],
    }),
  ],
  resolve: {
    extensions: ['.js', '.jsx'],
  },
  optimization: {
    minimize: isProduction,
  },
};

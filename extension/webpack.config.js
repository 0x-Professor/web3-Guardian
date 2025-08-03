const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const fs = require('fs');

// Ensure extension directory exists
const extensionDir = path.resolve(__dirname, 'extension');
if (!fs.existsSync(extensionDir)) {
  fs.mkdirSync(extensionDir, { recursive: true });
}

// Copy manifest file
const manifestSrc = path.resolve(__dirname, 'extension', 'manifest.json');
const manifestDest = path.resolve(extensionDir, 'manifest.json');
if (fs.existsSync(manifestSrc) && !fs.existsSync(manifestDest)) {
  fs.copyFileSync(manifestSrc, manifestDest);
}

module.exports = {
  entry: {
    popup: './extension/src/popup/popup.js',
    content: './extension/src/content/content.js',
    background: './extension/src/background/background.js',
  },
  output: {
    path: path.resolve(__dirname, 'extension'),
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
            presets: ['@babel/preset-env', '@babel/preset-react'],
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
      cleanStaleWebpackAssets: false, // Don't remove index.html
      cleanOnceBeforeBuildPatterns: [
        '**/*',
        '!manifest.json', // Keep the manifest file
        '!assets/**/*',  // Keep the assets directory
      ],
    }),
    new HtmlWebpackPlugin({
      template: './extension/src/popup/popup.html',
      filename: 'popup.html',
      chunks: ['popup'],
    }),
    new CopyPlugin({
      patterns: [
        { 
          from: 'extension/manifest.json',
          to: 'manifest.json',
          toType: 'file',
          force: true, // Overwrite if exists
          noErrorOnMissing: false
        },
        { 
          from: 'extension/src/assets',
          to: 'assets',
          noErrorOnMissing: true,
        },
      ],
    }),
  ],
  resolve: {
    extensions: ['.js', '.jsx'],
  },
  devtool: 'source-map',
};

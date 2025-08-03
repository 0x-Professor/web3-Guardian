const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const fs = require('fs');

// Set paths
const SRC_DIR = path.resolve(__dirname, 'src');
const BUILD_DIR = path.resolve(__dirname, 'dist');

// Ensure build directory exists
if (!fs.existsSync(BUILD_DIR)) {
  fs.mkdirSync(BUILD_DIR, { recursive: true });
}

// Copy manifest file to dist
const manifestSrc = path.resolve(SRC_DIR, 'manifest.json');
const manifestDest = path.resolve(BUILD_DIR, 'manifest.json');
if (fs.existsSync(manifestSrc) && !fs.existsSync(manifestDest)) {
  fs.copyFileSync(manifestSrc, manifestDest);
}

module.exports = {
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
      cleanOnceBeforeBuildPatterns: ['**/*'],
      cleanAfterEveryBuildPatterns: ['!manifest.json', '!assets/**/*'],
    }),
    new HtmlWebpackPlugin({
      template: './src/popup/popup.html',
      filename: 'popup.html',
      chunks: ['popup'],
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
  devtool: 'source-map',
};

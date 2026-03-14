const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Allow .onnx and .tflite to be bundled as assets
config.resolver.assetExts.push('onnx', 'tflite', 'bin', 'gguf', 'txt');

module.exports = config;

#!/bin/bash
# 创建构建目录
mkdir -p dist

# 复制所有必要文件
cp server.js dist/server.js
cp MyAITool.html dist/MyAITool.html
cp package.json dist/package.json

# 创建一个空的 index.js 作为入口文件（EAS 可能期望这个文件）
echo "require('./server.js');" > dist/index.js

echo "Build completed successfully!"

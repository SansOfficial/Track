#!/bin/bash

# Define output name
APP_NAME="trace-server-linux"
ZIP_NAME="release.zip"

echo "🚀 Starting Linux Release Build..."

# 1. Build Frontend
echo "📦 Building Frontend..."
cd admin
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Frontend build failed"
    exit 1
fi
cd ..

# 2. Prepare Backend Static Directory
echo "📂 Preparing Static Files..."
rm -rf server/dist
mkdir -p server/dist
cp -r admin/dist/* server/dist/

# 3. Build Backend for Linux
echo "🐧 Cross-Compiling Backend for Linux..."
cd server
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o $APP_NAME main.go
if [ $? -ne 0 ]; then
    echo "❌ Backend build failed"
    exit 1
fi
cd ..

# 4. Package into Zip
echo "🤐 Zipping Release Package..."
rm -f $ZIP_NAME
zip -r $ZIP_NAME server/$APP_NAME server/dist

# Cleanup binary from source folder to keep it clean (optional)
rm server/$APP_NAME

echo "✅ Release Package Created: $ZIP_NAME"
echo "   Upload this file to your server."

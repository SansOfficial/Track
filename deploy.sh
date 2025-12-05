#!/bin/bash

echo "🚀 Starting Deployment Build..."

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
echo "📂 Moving Frontend to Server..."
rm -rf server/dist
mkdir -p server/dist
cp -r admin/dist/* server/dist/

# 3. Build Backend (Optional, just to verify it compiles)
# echo "🔨 Building Backend..."
# cd server
# go build -o app main.go
# cd ..

echo "✅ Build Complete! You can now run the server:"
echo "   cd server && go run main.go"

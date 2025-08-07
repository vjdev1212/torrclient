#!/bin/bash
set -e

EXPO_DIR="./frontend"
SERVER_DIR="./server"
IMAGE_NAME="jarvisnexus/torrclient-server"
IMAGE_TAG="latest"

# Log output to a file
exec > >(tee build.log) 2>&1
trap 'echo "❌ Error occurred. Press ENTER to exit..."; read' ERR

echo "🌐 Building Expo PWA..."
cd "$EXPO_DIR"
npm install --force
npx expo export --platform web

echo "📁 Moving web output to $SERVER_DIR/public..."
rm -rf ../server/public
mv -f dist ../server/public
cd -

echo "🐳 Building multi-platform Docker image..."
docker buildx build \
  --platform linux/amd64,linux/arm64,linux/arm/v7 \
  --tag "$IMAGE_NAME:$IMAGE_TAG" \
  --push \
  "$SERVER_DIR"

echo "✅ Build completed. Press ENTER to exit..."
read

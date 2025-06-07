#!/bin/bash

echo "🐳 Building and testing deployment locally..."

# Build the Docker image
docker build -t temporal-minesweeper .

# Run the container
echo "🚀 Starting container..."
docker run -p 3000:3000 -p 8233:8233 temporal-minesweeper

echo "✅ Container started!"
echo "🎮 Game: http://localhost:3000"
echo "📊 Temporal UI: http://localhost:8233" 
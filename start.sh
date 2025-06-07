#!/bin/bash

# Temporal Minesweeper - Quick Start Script
echo "🚩 Starting Temporal Minesweeper..."

# Check if Temporal CLI is installed
if ! command -v temporal &> /dev/null; then
    echo "❌ Temporal CLI not found. Please install it first:"
    echo "   brew install temporal"
    echo "   Or visit: https://docs.temporal.io/cli"
    exit 1
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build the project if needed
if [ ! -d "dist" ]; then
    echo "🔨 Building project..."
    npm run build
fi

echo "✅ Setup complete!"
echo ""
echo "🚀 To run the application:"
echo ""
echo "1. Start Temporal server (in a new terminal):"
echo "   temporal server start-dev"
echo ""
echo "2. Start the Temporal worker (in a new terminal):"
echo "   npm run worker"
echo ""
echo "3. Start the web server (in a new terminal):"
echo "   npm start"
echo ""
echo "4. Open your browser to:"
echo "   http://localhost:3000"
echo ""
echo "📊 Monitor workflows at:"
echo "   http://localhost:8233"
echo ""
echo "Happy mining! 🚩💣" 
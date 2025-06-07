# Temporal Minesweeper 🚩

A modern Minesweeper game built with **Temporal Workflows** for state management, featuring a web-based UI and REST API backend.

## Architecture Overview

This application demonstrates the power of Temporal workflows for game state management:

- **Temporal Workflows**: Each game instance runs as a long-lived workflow that maintains game state in memory
- **Activities**: Pure functions for game logic (board creation, cell revealing, flag toggling)
- **Signals**: Used to send moves to the workflow (reveal, flag, unflag, restart)
- **Queries**: Used to retrieve current game state from the workflow
- **REST API**: Express.js server that interfaces with Temporal workflows
- **Frontend**: Modern HTML/CSS/JavaScript interface

## Features

- 🎮 Classic Minesweeper gameplay
- 🌐 Web-based interface with modern UI
- ⚡ Real-time game state updates
- 🔧 Configurable difficulty levels (Beginner, Intermediate, Expert, Custom)
- ⏱️ Game timer and statistics
- 🏃‍♂️ Powered by Temporal workflows (no database required!)
- 📱 Responsive design for mobile and desktop

## Prerequisites

- **Node.js** (v16 or higher)
- **Temporal Server** (see installation instructions below)

## Quick Start

### 1. Install Temporal CLI and Start Server

```bash
# Install Temporal CLI
brew install temporal

# Start Temporal server (in background)
temporal server start-dev
```

The Temporal Web UI will be available at http://localhost:8233

### 2. Install Dependencies and Build

```bash
# Install Node.js dependencies
npm install

# Build TypeScript code
npm run build
```

### 3. Start the Application

You need to run both the Temporal worker and the web server:

```bash
# Terminal 1: Start the Temporal worker
npm run worker

# Terminal 2: Start the web server
npm start
```

### 4. Play the Game!

Open your browser and navigate to:
```
http://localhost:3000
```

## Development Mode

For development with automatic rebuilding:

```bash
# Terminal 1: Build and watch TypeScript files
npm run dev

# Terminal 2: Start the Temporal worker
npm run worker
```

## Game Controls

- **Left Click**: Reveal a cell
- **Right Click**: Toggle flag on a cell
- **Goal**: Reveal all cells that don't contain mines
- **Numbers**: Show the count of neighboring mines

## API Endpoints

The application provides the following REST API endpoints:

### Create New Game
```http
POST /api/games
Content-Type: application/json

{
  "config": {
    "width": 9,
    "height": 9,
    "mineCount": 10
  }
}
```

### Get Game State
```http
GET /api/games/{gameId}
```

### Make a Move
```http
POST /api/games/{gameId}/moves
Content-Type: application/json

{
  "row": 0,
  "col": 0,
  "action": "reveal" | "flag" | "unflag"
}
```

### Restart Game
```http
POST /api/games/{gameId}/restart
Content-Type: application/json

{
  "config": {
    "width": 9,
    "height": 9,
    "mineCount": 10
  }
}
```

### Health Check
```http
GET /api/health
```

## How Temporal Powers the Game

### Workflows
Each game runs as a Temporal workflow (`minesweeperWorkflow`) that:
- Maintains game state in memory (no database needed!)
- Handles game operations through signals
- Provides game state through queries
- Runs indefinitely until manually terminated

### Activities
Game logic is implemented as Temporal activities:
- `createGameBoard`: Generates a new board with randomly placed mines
- `revealCell`: Handles cell revelation with cascade logic
- `toggleFlag`: Manages flag placement and removal

### Signals
Game operations are sent as signals to the workflow:
- `makeMoveSignal`: Sends player moves (reveal, flag, unflag)
- `restartGameSignal`: Restarts the game with new configuration

### Queries
Current game state is retrieved using queries:
- `getGameStateQuery`: Returns the current state of the game

## Project Structure

```
├── src/
│   ├── types.ts          # Type definitions
│   ├── activities.ts     # Temporal activities (game logic)
│   ├── workflows.ts      # Temporal workflows
│   ├── worker.ts         # Temporal worker
│   └── server.ts         # Express.js REST API server
├── public/
│   ├── index.html        # Game interface
│   ├── styles.css        # Styling
│   └── script.js         # Frontend JavaScript
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
└── README.md            # This file
```

## Customization

You can customize the game by modifying:

- **Difficulty levels**: Edit the configs in `public/script.js`
- **Game logic**: Modify activities in `src/activities.ts`
- **UI styling**: Update `public/styles.css`
- **API endpoints**: Extend `src/server.ts`

## Temporal Web UI

Monitor your game workflows in the Temporal Web UI at http://localhost:8233. You can:
- View running workflows (active games)
- Inspect workflow history and events
- See signal and query operations
- Debug workflow executions

## Troubleshooting

### Temporal Server Issues
- Make sure Temporal server is running: `temporal server start-dev`
- Check if port 7233 is available
- Verify Temporal CLI installation

### Build Issues
- Run `npm run clean` to clear built files
- Ensure TypeScript is properly installed
- Check Node.js version (requires v16+)

### Game Not Loading
- Check browser console for errors
- Verify both worker and server are running
- Ensure Temporal server is accessible

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - feel free to use this project for learning and experimentation!

---

**Happy Mining!** 🚩💣 
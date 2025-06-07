# Temporal Minesweeper 🚩

A modern, full-featured Minesweeper game built with **Temporal Workflows** for state management, featuring web-based UI, global leaderboards, player statistics, and production-ready deployment.

## 🌟 Key Features

- 🎮 **Classic Minesweeper gameplay** with modern UI
- 🏆 **Global leaderboard system** with multiple ranking categories
- 📊 **Player statistics** across sessions
- ⚡ **Real-time game state updates** powered by Temporal
- 🔧 **Configurable difficulty levels** (Beginner, Intermediate, Expert, Custom)
- ⏱️ **Game timer and detailed statistics**
- 🌐 **Session-based player tracking**
- 🚀 **Production-ready deployment** with Docker and cloud platforms
- 📱 **Responsive design** for mobile and desktop
- 🎯 **Advanced features**: Chord reveal, auto-flagging, cascading reveals

## Architecture Overview

This application demonstrates enterprise-grade game architecture using Temporal workflows:

### Core Components
- **Game Workflows**: Each game runs as a long-lived workflow maintaining state in memory
- **Leaderboard Workflow**: Global singleton workflow managing all leaderboards and player stats
- **Activities**: Pure functions for game logic (board creation, cell revealing, flag toggling, chord reveal)
- **Signals & Updates**: Real-time game operations with instant feedback
- **Queries**: Fast retrieval of game state and leaderboard data
- **REST API**: Express.js server interfacing with Temporal workflows
- **Frontend**: Modern HTML/CSS/JavaScript with advanced game features

### Temporal Patterns Used
- **Long-running workflows** for game state persistence
- **Global singleton workflows** for leaderboard management
- **Signal/Query pattern** for real-time interactions
- **Update pattern** for immediate state feedback
- **Activity composition** for complex game logic
- **Workflow timers** for auto-cleanup after inactivity

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

## 🎮 Game Controls & Features

### Basic Controls
- **Left Click**: Reveal a cell
- **Right Click**: Toggle flag on a cell
- **Middle Click/Shift+Click**: Chord reveal (reveal neighbors when flags match mine count)

### Advanced Features
- **Chord Reveal**: Click on a revealed number to auto-reveal neighbors when correct flags are placed
- **Cascading Reveals**: Empty cells automatically reveal connected empty areas
- **Smart Flagging**: Right-click cycles through unflagged → flagged → unflagged
- **Game Statistics**: Track time, cells revealed, flags used, and win/loss record
- **Session Persistence**: Your game state persists across browser sessions

### Game Modes
- **Beginner**: 9×9 grid, 10 mines
- **Intermediate**: 16×16 grid, 40 mines  
- **Expert**: 30×16 grid, 99 mines
- **Custom**: Configure your own grid size and mine count

## 🏆 Leaderboard System

The game features a comprehensive leaderboard system with multiple ranking categories:

### Ranking Categories
- **Fastest Time**: Best completion times for each difficulty
- **Most Wins**: Players with the most victories  
- **Best Win Rate**: Highest win percentage (minimum 5 games)
- **Total Games**: Most active players

### Difficulty Levels
- Separate leaderboards for Beginner, Intermediate, Expert, and Custom games
- Global leaderboards across all difficulties

### Player Statistics
- Total games played and won
- Win rate percentage
- Best times for each difficulty level


## 📡 Complete API Reference

### Game Management

#### Create New Game
```http
POST /api/games
Content-Type: application/json

{
  "config": {
    "width": 9,
    "height": 9,
    "mineCount": 10
  },
  "sessionId": "optional-session-id"
}
```

#### Get Game State
```http
GET /api/games/{gameId}
```

#### Make a Move
```http
POST /api/games/{gameId}/moves
Content-Type: application/json

{
  "row": 0,
  "col": 0,
  "action": "reveal" | "flag" | "unflag" | "chord"
}
```

#### Restart Game
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

### Player & Session Management

#### Get Player Statistics
```http
GET /api/players/{playerId}/stats
```

### Leaderboards

#### Get Leaderboard
```http
GET /api/leaderboard?category=FASTEST_TIME&difficulty=BEGINNER&limit=10
```

**Parameters:**
- `category`: `FASTEST_TIME` | `MOST_WINS` | `BEST_WIN_RATE` | `TOTAL_GAMES`
- `difficulty`: `BEGINNER` | `INTERMEDIATE` | `EXPERT` | `CUSTOM` (optional)
- `limit`: Number of entries to return (default: 10)

### Utility

#### Health Check
```http
GET /api/health
```

## 🚀 Production Deployment

This application is production-ready with comprehensive deployment support:

### Quick Deploy Options
- **Railway** (Recommended): One-click deployment from GitHub
- **Render**: Docker-based deployment 
- **Fly.io**: Global edge deployment
- **Self-hosted**: Docker Compose setup

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for detailed deployment instructions.

### Docker Support
```bash
# Build and test locally
npm run docker:build
npm run docker:run

# Test full deployment
npm run deploy:test
```

## 🏗️ How Temporal Powers the Game

### Game Workflows (`minesweeperWorkflow`)
Each game runs as a Temporal workflow that:
- Maintains complete game state in memory (no database required!)
- Handles real-time game operations through signals and updates
- Provides instant game state through queries
- Auto-closes after 24 hours of inactivity to prevent resource leaks
- Supports game restart without losing workflow continuity

### Leaderboard Workflow (`leaderboardWorkflow`)
A global singleton workflow that:
- Manages all leaderboard rankings and player statistics
- Processes completed games and updates rankings in real-time
- Maintains persistent state across server restarts
- Handles concurrent updates from multiple games safely

### Activities (Game Logic)
- `createGameBoard`: Generates boards with cryptographically random mine placement
- `revealCell`: Handles cell revelation with intelligent cascading logic
- `toggleFlag`: Manages flag placement with validation
- `chordReveal`: Advanced reveal logic for numbered cells

### Signals & Updates
- **Signals**: Fire-and-forget operations (moves, restarts)
- **Updates**: Operations that return updated state immediately
- **Queries**: Fast, consistent state retrieval

## 📁 Project Structure

```
├── src/
│   ├── types.ts          # Comprehensive type definitions
│   ├── activities.ts     # Game logic activities
│   ├── workflows.ts      # Game and leaderboard workflows  
│   ├── worker.ts         # Temporal worker
│   └── server.ts         # Express.js API server
├── public/
│   ├── index.html        # Game interface
│   ├── styles.css        # Modern responsive styling
│   └── script.js         # Advanced frontend logic
├── deployment/
│   ├── Dockerfile        # Production container
│   ├── railway.toml      # Railway deployment config
│   ├── ecosystem.config.js # PM2 process management
│   └── deploy-local.sh   # Local deployment script
├── DEPLOYMENT.md         # Comprehensive deployment guide
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
└── README.md            # This file
```

## 🎯 Advanced Customization

### Game Logic
- **Board Generation**: Modify `createGameBoard` in `activities.ts`
- **Reveal Logic**: Customize cascading behavior in `revealCell`
- **Win Conditions**: Adjust victory/defeat logic
- **Timing**: Configure auto-close timeouts in workflows

### Leaderboard System
- **Ranking Categories**: Add new categories in `workflows.ts`
- **Difficulty Classifications**: Modify difficulty detection logic
- **Statistics**: Enhance player stat tracking

### UI & Styling
- **Visual Design**: Update `public/styles.css`
- **Game Interface**: Modify `public/script.js`
- **Responsive Layout**: Adjust media queries for different screen sizes

### API & Integration
- **Authentication**: Add user authentication system
- **Database**: Integrate persistent storage for enhanced features
- **Real-time Updates**: Add WebSocket support for live multiplayer

## 🔍 Temporal Web UI Monitoring

Monitor your application in the Temporal Web UI at http://localhost:8233:

### Game Workflows
- View active games and their current state
- Inspect game move history and signals
- Debug workflow executions and failures
- Monitor workflow performance and timing

### Leaderboard Workflow  
- Track leaderboard updates and player statistics
- Monitor signal processing for completed games
- View workflow event history and state changes

### System Health
- Monitor worker activity and task processing
- Track workflow completion rates and errors
- Analyze performance metrics and bottlenecks

## 🐛 Troubleshooting

### Temporal Server Issues
- Ensure Temporal server is running: `temporal server start-dev`
- Check port 7233 availability
- Verify Temporal CLI installation and version

### Build & Runtime Issues
- Clear build cache: `npm run clean && npm run build`
- Check Node.js version compatibility (requires v16+)
- Verify all dependencies are installed: `npm install`

### Game Not Loading
- Check browser console for JavaScript errors
- Ensure both worker and server are running
- Verify Temporal server connectivity
- Check network requests in browser dev tools

### Leaderboard Issues
- Verify leaderboard workflow is running in Temporal UI
- Check server logs for leaderboard-related errors
- Ensure games are completing properly (status = WON/LOST)

### Deployment Issues
- Test Docker build locally: `npm run deploy:test`
- Check platform-specific logs in hosting dashboard
- Verify environment variables and port configuration
- Monitor resource usage (memory/CPU limits)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Follow existing code patterns and TypeScript types
4. Add tests for new functionality
5. Test thoroughly including Temporal workflow behavior
6. Submit a pull request with detailed description

## 📄 License

MIT License - feel free to use this project for learning, experimentation, and production deployments!

---

**🚩 Happy Mining!** Deploy your own instance and challenge friends to beat your leaderboard! 🏆 
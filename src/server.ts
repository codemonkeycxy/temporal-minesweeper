import express from 'express';
import cors from 'cors';
import { Client, Connection } from '@temporalio/client';
import { v4 as uuidv4 } from 'uuid';
import { minesweeperWorkflow, makeMoveUpdate, restartGameUpdate, getGameStateQuery, leaderboardWorkflow, addGameResultSignal, getLeaderboardQuery, getPlayerStatsQuery } from './workflows';
import { CreateGameRequest, MoveRequest, GameConfig, GameResult, LeaderboardQuery } from './types';
import path from 'path';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

let client: Client;
const LEADERBOARD_WORKFLOW_ID = 'global-leaderboard';

// In-memory storage for completed games (session-based)
const gameResults: Map<string, GameResult[]> = new Map();

// Track active games with their session IDs
const activeGames: Map<string, string> = new Map(); // gameId -> sessionId

async function initializeClient() {
  const temporalAddress = process.env.TEMPORAL_ADDRESS || 'localhost:7233';
  const connection = await Connection.connect({ address: temporalAddress });
  client = new Client({
    connection,
  });
  console.log(`Connected to Temporal server at: ${temporalAddress}`);
}

async function initializeLeaderboard() {
  try {
    // Try to start the leaderboard workflow
    await client.workflow.start(leaderboardWorkflow, {
      args: [],
      taskQueue: 'minesweeper-task-queue',
      workflowId: LEADERBOARD_WORKFLOW_ID,
    });
    console.log('Started leaderboard workflow');
  } catch (error: any) {
    // If workflow already exists, that's fine
    if (error.name === 'WorkflowExecutionAlreadyStartedError' || 
        error.message?.includes('already started') ||
        error.message?.includes('WorkflowExecutionAlreadyStarted')) {
      console.log('Leaderboard workflow is already running');
    } else {
      console.error('Error initializing leaderboard:', error);
      throw error;
    }
  }
}

// Function to save completed game result
async function saveGameResult(gameResult: GameResult) {
  const sessionId = gameResult.sessionId;
  if (!gameResults.has(sessionId)) {
    gameResults.set(sessionId, []);
  }
  gameResults.get(sessionId)!.push(gameResult);
  
  // Remove from active games
  activeGames.delete(gameResult.id);
  
  // Send to leaderboard workflow if the game was won
  if (gameResult.status === 'WON') {
    try {
      const leaderboardHandle = client.workflow.getHandle(LEADERBOARD_WORKFLOW_ID);
      await leaderboardHandle.signal(addGameResultSignal, gameResult);
      console.log(`Sent game result to leaderboard for session ${sessionId}`);
    } catch (error) {
      console.error('Error sending game result to leaderboard:', error);
    }
  }
  
  console.log(`Saved game result for session ${sessionId}: ${gameResult.status}`);
}

// Helper function to retry query with delays
async function queryWithRetry(handle: any, query: any, maxRetries = 5): Promise<any> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await handle.query(query);
    } catch (error: any) {
      if (error.code === 3 && i < maxRetries - 1) { // QueryNotRegisteredError
        console.log(`Query not ready yet, retrying in ${(i + 1) * 100}ms...`);
        await new Promise(resolve => setTimeout(resolve, (i + 1) * 100));
        continue;
      }
      throw error;
    }
  }
}

// Create a new game
app.post('/api/games', async (req, res) => {
  try {
    const { config, sessionId }: CreateGameRequest = req.body;
    
    // Validate config
    if (!config || !config.width || !config.height || !config.mineCount) {
      return res.status(400).json({ error: 'Invalid game configuration' });
    }

    if (config.mineCount >= config.width * config.height) {
      return res.status(400).json({ error: 'Too many mines for the board size' });
    }

    const gameId = uuidv4();
    
    // Store the session ID for this game if provided
    if (sessionId) {
      activeGames.set(gameId, sessionId);
    }
    
    // Start the workflow
    await client.workflow.start(minesweeperWorkflow, {
      args: [gameId, config],
      taskQueue: 'minesweeper-task-queue',
      workflowId: gameId,
    });

    // Get initial game state with retry
    const handle = client.workflow.getHandle(gameId);
    const gameState = await queryWithRetry(handle, getGameStateQuery);

    res.json({ gameState });
  } catch (error) {
    console.error('Error creating game:', error);
    res.status(500).json({ error: 'Failed to create game' });
  }
});

// Get game state
app.get('/api/games/:gameId', async (req, res) => {
  try {
    const { gameId } = req.params;
    
    const handle = client.workflow.getHandle(gameId);
    const gameState = await queryWithRetry(handle, getGameStateQuery);

    // Check if game just completed and save result
    if ((gameState.status === 'WON' || gameState.status === 'LOST') && 
        gameState.startTime && gameState.endTime && 
        activeGames.has(gameId)) {
      
      const sessionId = activeGames.get(gameId)!;
      const duration = Math.floor((new Date(gameState.endTime).getTime() - new Date(gameState.startTime).getTime()) / 1000);
      
      const gameResult: GameResult = {
        id: gameId,
        sessionId,
        config: {
          width: gameState.board.width,
          height: gameState.board.height,
          mineCount: gameState.board.mineCount
        },
        status: gameState.status,
        startTime: new Date(gameState.startTime),
        endTime: new Date(gameState.endTime),
        duration,
        cellsRevealed: gameState.cellsRevealed,
        flagsUsed: gameState.flagsUsed
      };
      
      await saveGameResult(gameResult);
    }

    res.json({ gameState });
  } catch (error) {
    console.error('Error getting game state:', error);
    res.status(404).json({ error: 'Game not found' });
  }
});

// Make a move
app.post('/api/games/:gameId/moves', async (req, res) => {
  try {
    const { gameId } = req.params;
    const moveRequest: MoveRequest = req.body;

    // Validate move request
    if (typeof moveRequest.row !== 'number' || 
        typeof moveRequest.col !== 'number' || 
        !['reveal', 'flag', 'unflag', 'chord'].includes(moveRequest.action)) {
      return res.status(400).json({ error: 'Invalid move request' });
    }

    const handle = client.workflow.getHandle(gameId);
    
    // Execute move update and get the updated state directly
    const gameState = await handle.executeUpdate(makeMoveUpdate, { args: [moveRequest] });

    // Check if game just completed and save result
    if ((gameState.status === 'WON' || gameState.status === 'LOST') && 
        gameState.startTime && gameState.endTime && 
        activeGames.has(gameId)) {
      
      const sessionId = activeGames.get(gameId)!;
      const duration = Math.floor((new Date(gameState.endTime).getTime() - new Date(gameState.startTime).getTime()) / 1000);
      
      const gameResult: GameResult = {
        id: gameId,
        sessionId,
        config: {
          width: gameState.board.width,
          height: gameState.board.height,
          mineCount: gameState.board.mineCount
        },
        status: gameState.status,
        startTime: new Date(gameState.startTime),
        endTime: new Date(gameState.endTime),
        duration,
        cellsRevealed: gameState.cellsRevealed,
        flagsUsed: gameState.flagsUsed
      };
      
      await saveGameResult(gameResult);
    }

    res.json({ gameState });
  } catch (error) {
    console.error('Error making move:', error);
    res.status(500).json({ error: 'Failed to make move' });
  }
});

// Restart game
app.post('/api/games/:gameId/restart', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { config }: { config: GameConfig } = req.body;

    // Validate config
    if (!config || !config.width || !config.height || !config.mineCount) {
      return res.status(400).json({ error: 'Invalid game configuration' });
    }

    const handle = client.workflow.getHandle(gameId);
    
    // Execute restart update and get the updated state directly
    const gameState = await handle.executeUpdate(restartGameUpdate, { args: [config] });

    res.json({ gameState });
  } catch (error) {
    console.error('Error restarting game:', error);
    res.status(500).json({ error: 'Failed to restart game' });
  }
});

// Get game history for a session
app.get('/api/sessions/:sessionId/games', (req, res) => {
  try {
    const { sessionId } = req.params;
    const games = gameResults.get(sessionId) || [];
    
    // Sort by end time, most recent first
    const sortedGames = games.sort((a, b) => b.endTime.getTime() - a.endTime.getTime());
    
    res.json({ games: sortedGames });
  } catch (error) {
    console.error('Error getting game history:', error);
    res.status(500).json({ error: 'Failed to get game history' });
  }
});

// Get leaderboard
app.get('/api/leaderboard', async (req, res) => {
  try {
    const { category = 'FASTEST_TIME', difficulty, limit = 10 } = req.query;
    
    const query: LeaderboardQuery = {
      category: category as any,
      difficulty: difficulty as any,
      limit: parseInt(limit as string) || 10
    };

    const leaderboardHandle = client.workflow.getHandle(LEADERBOARD_WORKFLOW_ID);
    const leaderboard = await leaderboardHandle.query(getLeaderboardQuery, query);
    
    res.json(leaderboard);
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

// Get player stats
app.get('/api/players/:playerId/stats', async (req, res) => {
  try {
    const { playerId } = req.params;
    
    const leaderboardHandle = client.workflow.getHandle(LEADERBOARD_WORKFLOW_ID);
    const stats = await leaderboardHandle.query(getPlayerStatsQuery, playerId);
    
    if (!stats) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    res.json(stats);
  } catch (error) {
    console.error('Error getting player stats:', error);
    res.status(500).json({ error: 'Failed to get player stats' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve the frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

async function startServer() {
  try {
    await initializeClient();
    await initializeLeaderboard();
    
    app.listen(port, () => {
      console.log(`Minesweeper server running on http://localhost:${port}`);
      console.log('Make sure to start the Temporal worker in another terminal: npm run worker');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer(); 
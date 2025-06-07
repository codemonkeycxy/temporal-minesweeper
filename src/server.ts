import express from 'express';
import cors from 'cors';
import { Client, Connection } from '@temporalio/client';
import { v4 as uuidv4 } from 'uuid';
import { minesweeperWorkflow, makeMoveUpdate, restartGameUpdate, getGameStateQuery } from './workflows';
import { CreateGameRequest, MoveRequest, GameConfig } from './types';
import path from 'path';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

let client: Client;

async function initializeClient() {
  const temporalAddress = process.env.TEMPORAL_ADDRESS || 'localhost:7233';
  const connection = await Connection.connect({ address: temporalAddress });
  client = new Client({
    connection,
  });
  console.log(`Connected to Temporal server at: ${temporalAddress}`);
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
    const { config }: CreateGameRequest = req.body;
    
    // Validate config
    if (!config || !config.width || !config.height || !config.mineCount) {
      return res.status(400).json({ error: 'Invalid game configuration' });
    }

    if (config.mineCount >= config.width * config.height) {
      return res.status(400).json({ error: 'Too many mines for the board size' });
    }

    const gameId = uuidv4();
    
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
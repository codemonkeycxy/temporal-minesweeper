import { proxyActivities, defineSignal, defineQuery, defineUpdate, setHandler, condition, sleep } from '@temporalio/workflow';
import type * as activities from './activities';
import { GameState, GameStatus, MoveRequest, GameConfig } from './types';

const { createGameBoard, revealCell, toggleFlag, chordReveal } = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
});

// Signals for game operations
export const makeMoveSignal = defineSignal<[MoveRequest]>('makeMove');
export const restartGameSignal = defineSignal<[GameConfig]>('restartGame');
export const closeGameSignal = defineSignal('closeGame');

// Updates for game operations (return updated state)
export const makeMoveUpdate = defineUpdate<GameState, [MoveRequest]>('makeMoveUpdate');
export const restartGameUpdate = defineUpdate<GameState, [GameConfig]>('restartGameUpdate');

// Queries for getting game state
export const getGameStateQuery = defineQuery<GameState>('getGameState');

export async function minesweeperWorkflow(gameId: string, initialConfig: GameConfig): Promise<void> {
  // Initialize game state with a placeholder - will be properly set after board creation
  let gameState: GameState | null = null;
  let lastActivityTime = Date.now();
  let shouldClose = false;

  // Set up all handlers first (synchronously)
  setHandler(makeMoveSignal, async (moveRequest: MoveRequest) => {
    if (!gameState || gameState.status === GameStatus.WON || gameState.status === GameStatus.LOST || gameState.status === GameStatus.CLOSED) {
      return; // Game not ready or game is over, ignore moves
    }

    // Update activity time
    lastActivityTime = Date.now();

    // Start the game on first move
    if (gameState.status === GameStatus.NOT_STARTED) {
      gameState.status = GameStatus.IN_PROGRESS;
      gameState.startTime = new Date();
    }

    const { row, col, action } = moveRequest;

    try {
      if (action === 'reveal') {
        gameState = await revealCell(gameState, row, col);
      } else if (action === 'flag' || action === 'unflag') {
        gameState = await toggleFlag(gameState, row, col);
      } else if (action === 'chord') {
        gameState = await chordReveal(gameState, row, col);
      }
    } catch (error) {
      console.error('Error processing move:', error);
    }
  });

  setHandler(restartGameSignal, async (config: GameConfig) => {
    if (gameState && gameState.status === GameStatus.CLOSED) {
      return; // Cannot restart closed games
    }
    
    // Update activity time
    lastActivityTime = Date.now();
    
    const newBoard = await createGameBoard(config);
    gameState = {
      id: gameId,
      board: newBoard,
      status: GameStatus.NOT_STARTED,
      flagsUsed: 0,
      cellsRevealed: 0
    };
  });

  setHandler(closeGameSignal, () => {
    shouldClose = true;
  });

  // Update handlers (return the updated state)
  setHandler(makeMoveUpdate, async (moveRequest: MoveRequest): Promise<GameState> => {
    if (!gameState || gameState.status === GameStatus.WON || gameState.status === GameStatus.LOST || gameState.status === GameStatus.CLOSED) {
      // Return current state if game not ready or game is over
      return gameState || {
        id: gameId,
        board: {
          cells: [],
          width: initialConfig.width,
          height: initialConfig.height,
          mineCount: initialConfig.mineCount
        },
        status: GameStatus.NOT_STARTED,
        flagsUsed: 0,
        cellsRevealed: 0
      };
    }

    // Update activity time
    lastActivityTime = Date.now();

    // Start the game on first move
    if (gameState.status === GameStatus.NOT_STARTED) {
      gameState.status = GameStatus.IN_PROGRESS;
      gameState.startTime = new Date();
    }

    const { row, col, action } = moveRequest;

    try {
      if (action === 'reveal') {
        gameState = await revealCell(gameState, row, col);
      } else if (action === 'flag' || action === 'unflag') {
        gameState = await toggleFlag(gameState, row, col);
      } else if (action === 'chord') {
        gameState = await chordReveal(gameState, row, col);
      }
    } catch (error) {
      console.error('Error processing move:', error);
    }

    return gameState;
  });

  setHandler(restartGameUpdate, async (config: GameConfig): Promise<GameState> => {
    if (gameState && gameState.status === GameStatus.CLOSED) {
      return gameState; // Cannot restart closed games
    }
    
    // Update activity time
    lastActivityTime = Date.now();
    
    const newBoard = await createGameBoard(config);
    gameState = {
      id: gameId,
      board: newBoard,
      status: GameStatus.NOT_STARTED,
      flagsUsed: 0,
      cellsRevealed: 0
    };
    return gameState;
  });

  // Set up query handler - return null if game not ready yet
  setHandler(getGameStateQuery, () => {
    if (!gameState) {
      // Return a minimal valid state while initializing
      return {
        id: gameId,
        board: {
          cells: [],
          width: initialConfig.width,
          height: initialConfig.height,
          mineCount: initialConfig.mineCount
        },
        status: GameStatus.NOT_STARTED,
        flagsUsed: 0,
        cellsRevealed: 0
      };
    }
    return gameState;
  });

  // Now create the initial board (after handlers are set up)
  const initialBoard = await createGameBoard(initialConfig);
  gameState = {
    id: gameId,
    board: initialBoard,
    status: GameStatus.NOT_STARTED,
    flagsUsed: 0,
    cellsRevealed: 0
  };

  // Auto-close workflow after 24 hours of inactivity
  const INACTIVITY_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours
  const CHECK_INTERVAL_MS = 60 * 1000; // Check every minute

  try {
    while (!shouldClose) {
      // Wait for either close signal or timeout
      const timeoutReached = await condition(
        () => shouldClose || (Date.now() - lastActivityTime) >= INACTIVITY_TIMEOUT_MS,
        CHECK_INTERVAL_MS
      );

      if (shouldClose) {
        break;
      }

      // Check if we've reached the inactivity timeout
      if ((Date.now() - lastActivityTime) >= INACTIVITY_TIMEOUT_MS) {
        console.log(`Game ${gameId} auto-closing due to 24 hours of inactivity`);
        break;
      }
    }
  } catch (error) {
    console.error('Error in workflow loop:', error);
  }

  // Mark the game as closed
  if (gameState) {
    gameState.status = GameStatus.CLOSED;
    gameState.endTime = new Date();
  }

  console.log(`Minesweeper workflow ${gameId} completed`);
} 
import { proxyActivities, defineSignal, defineQuery, defineUpdate, setHandler, condition } from '@temporalio/workflow';
import type * as activities from './activities';
import { GameState, GameStatus, MoveRequest, GameConfig } from './types';

const { createGameBoard, revealCell, toggleFlag, chordReveal } = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
});

// Signals for game operations
export const makeMoveSignal = defineSignal<[MoveRequest]>('makeMove');
export const restartGameSignal = defineSignal<[GameConfig]>('restartGame');

// Updates for game operations (return updated state)
export const makeMoveUpdate = defineUpdate<GameState, [MoveRequest]>('makeMoveUpdate');
export const restartGameUpdate = defineUpdate<GameState, [GameConfig]>('restartGameUpdate');

// Queries for getting game state
export const getGameStateQuery = defineQuery<GameState>('getGameState');

export async function minesweeperWorkflow(gameId: string, initialConfig: GameConfig): Promise<void> {
  // Initialize game state with a placeholder - will be properly set after board creation
  let gameState: GameState | null = null;

  // Set up all handlers first (synchronously)
  setHandler(makeMoveSignal, async (moveRequest: MoveRequest) => {
    if (!gameState || gameState.status === GameStatus.WON || gameState.status === GameStatus.LOST) {
      return; // Game not ready or game is over, ignore moves
    }

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
    const newBoard = await createGameBoard(config);
    gameState = {
      id: gameId,
      board: newBoard,
      status: GameStatus.NOT_STARTED,
      flagsUsed: 0,
      cellsRevealed: 0
    };
  });

  // Update handlers (return the updated state)
  setHandler(makeMoveUpdate, async (moveRequest: MoveRequest): Promise<GameState> => {
    if (!gameState || gameState.status === GameStatus.WON || gameState.status === GameStatus.LOST) {
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

  // Keep the workflow running indefinitely
  // In a real application, you might want to add a timeout or completion condition
  await condition(() => false); // This will keep the workflow running
} 
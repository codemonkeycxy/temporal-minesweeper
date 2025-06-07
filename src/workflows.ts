import { proxyActivities, defineSignal, defineQuery, defineUpdate, setHandler, condition, sleep, upsertSearchAttributes } from '@temporalio/workflow';
import type * as activities from './activities';
import { GameState, GameStatus, MoveRequest, GameConfig, GameResult, DifficultyLevel, LeaderboardCategory, LeaderboardEntry, LeaderboardQuery, LeaderboardResponse, PlayerStats } from './types';

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

// Leaderboard workflow signals and queries
export const addGameResultSignal = defineSignal<[GameResult]>('addGameResult');
export const getLeaderboardQuery = defineQuery<LeaderboardResponse, [LeaderboardQuery]>('getLeaderboard');
export const getPlayerStatsQuery = defineQuery<PlayerStats | null, [string]>('getPlayerStats');

export async function minesweeperWorkflow(gameId: string, initialConfig: GameConfig, sessionId?: string): Promise<void> {
  // Set search attributes for the workflow - only gameId
  await upsertSearchAttributes({
    gameId: [gameId]
  });

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

      // Set end time if game completed
      if (gameState.status === GameStatus.WON || gameState.status === GameStatus.LOST) {
        gameState.endTime = new Date();
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
      cellsRevealed: 0,
      sessionId
    };
  });

  setHandler(closeGameSignal, async () => {
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
        cellsRevealed: 0,
        sessionId
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

      // Set end time if game completed
      if (gameState.status === GameStatus.WON || gameState.status === GameStatus.LOST) {
        gameState.endTime = new Date();
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
      cellsRevealed: 0,
      sessionId
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
        cellsRevealed: 0,
        sessionId
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
    cellsRevealed: 0,
    sessionId // Store sessionId in game state
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

// Helper function to determine difficulty level
function getDifficultyLevel(config: GameConfig): DifficultyLevel {
  const { width, height, mineCount } = config;
  
  // Standard difficulties
  if (width === 9 && height === 9 && mineCount === 10) {
    return DifficultyLevel.BEGINNER;
  }
  if (width === 16 && height === 16 && mineCount === 40) {
    return DifficultyLevel.INTERMEDIATE;
  }
  if (width === 30 && height === 16 && mineCount === 99) {
    return DifficultyLevel.EXPERT;
  }
  
  return DifficultyLevel.CUSTOM;
}

export async function leaderboardWorkflow(): Promise<void> {
  // Leaderboard state - organized by category and difficulty
  const leaderboards: { [key: string]: LeaderboardEntry[] } = {};
  const playerStats: { [playerId: string]: PlayerStats } = {};
  let lastUpdated = new Date();

  // Helper function to get leaderboard key
  function getLeaderboardKey(category: LeaderboardCategory, difficulty?: DifficultyLevel): string {
    return difficulty ? `${category}_${difficulty}` : category;
  }

  // Helper function to update player stats
  function updatePlayerStats(gameResult: GameResult, difficulty: DifficultyLevel) {
    const playerId = gameResult.sessionId;
    let stats = playerStats[playerId];
    
    if (!stats) {
      stats = {
        playerId,
        totalGames: 0,
        totalWins: 0,
        winRate: 0,
        bestTimes: {} as any, // Will store as plain object
        lastPlayed: gameResult.endTime
      };
      playerStats[playerId] = stats;
    }

    stats.totalGames++;
    if (gameResult.status === GameStatus.WON) {
      stats.totalWins++;
      
      // Update best time for this difficulty
      const bestTimesObj = stats.bestTimes as any;
      const currentBest = bestTimesObj[difficulty];
      if (!currentBest || gameResult.duration < currentBest) {
        bestTimesObj[difficulty] = gameResult.duration;
      }
    }
    
    stats.winRate = stats.totalWins / stats.totalGames;
    stats.lastPlayed = gameResult.endTime;
  }

  // Helper function to add entry to leaderboard
  function addToLeaderboard(key: string, entry: LeaderboardEntry, maxEntries: number = 100) {
    let entries = leaderboards[key] || [];
    entries.push(entry);
    
    // Sort based on category type
    if (key.includes('FASTEST_TIME')) {
      entries.sort((a, b) => a.value - b.value); // Ascending for time
    } else {
      entries.sort((a, b) => b.value - a.value); // Descending for counts/rates
    }
    
    // Keep only top entries
    entries = entries.slice(0, maxEntries);
    leaderboards[key] = entries;
  }

  // Signal handler for adding game results
  setHandler(addGameResultSignal, (gameResult: GameResult) => {
    // Only process won games for leaderboards
    if (gameResult.status !== GameStatus.WON) {
      return;
    }

    const difficulty = getDifficultyLevel(gameResult.config);
    const stats = playerStats[gameResult.sessionId];
    
    // Update player stats first
    updatePlayerStats(gameResult, difficulty);
    const updatedStats = playerStats[gameResult.sessionId]!

    // Create base entry
    const baseEntry: Omit<LeaderboardEntry, 'value'> = {
      playerId: gameResult.sessionId,
      gameId: gameResult.id,
      difficulty,
      timestamp: gameResult.endTime,
      gameConfig: gameResult.config,
      totalGames: updatedStats.totalGames,
      totalWins: updatedStats.totalWins,
      winRate: updatedStats.winRate
    };

    // Add to fastest time leaderboard
    const fastestTimeEntry: LeaderboardEntry = {
      ...baseEntry,
      value: gameResult.duration
    };
    addToLeaderboard(getLeaderboardKey(LeaderboardCategory.FASTEST_TIME, difficulty), fastestTimeEntry);
    addToLeaderboard(getLeaderboardKey(LeaderboardCategory.FASTEST_TIME), fastestTimeEntry);

    // Add to most wins leaderboard (only if this represents their current total)
    const mostWinsEntry: LeaderboardEntry = {
      ...baseEntry,
      value: updatedStats.totalWins
    };
    
    // Remove previous entry for this player from most wins leaderboards
    const mostWinsKey = getLeaderboardKey(LeaderboardCategory.MOST_WINS, difficulty);
    const mostWinsGlobalKey = getLeaderboardKey(LeaderboardCategory.MOST_WINS);
    
    let mostWinsEntries = leaderboards[mostWinsKey] || [];
    mostWinsEntries = mostWinsEntries.filter((e: LeaderboardEntry) => e.playerId !== gameResult.sessionId);
    mostWinsEntries.push(mostWinsEntry);
    mostWinsEntries.sort((a: LeaderboardEntry, b: LeaderboardEntry) => b.value - a.value);
    leaderboards[mostWinsKey] = mostWinsEntries.slice(0, 100);

    let mostWinsGlobalEntries = leaderboards[mostWinsGlobalKey] || [];
    mostWinsGlobalEntries = mostWinsGlobalEntries.filter((e: LeaderboardEntry) => e.playerId !== gameResult.sessionId);
    mostWinsGlobalEntries.push(mostWinsEntry);
    mostWinsGlobalEntries.sort((a: LeaderboardEntry, b: LeaderboardEntry) => b.value - a.value);
    leaderboards[mostWinsGlobalKey] = mostWinsGlobalEntries.slice(0, 100);

    // Add to best win rate leaderboard (only if player has played at least 5 games)
    if (updatedStats.totalGames >= 5) {
      const winRateEntry: LeaderboardEntry = {
        ...baseEntry,
        value: Math.round(updatedStats.winRate * 10000) / 100 // Convert to percentage with 2 decimal places
      };
      
      // Remove previous entry for this player from win rate leaderboards
      const winRateKey = getLeaderboardKey(LeaderboardCategory.BEST_WIN_RATE, difficulty);
      const winRateGlobalKey = getLeaderboardKey(LeaderboardCategory.BEST_WIN_RATE);
      
      let winRateEntries = leaderboards[winRateKey] || [];
      winRateEntries = winRateEntries.filter((e: LeaderboardEntry) => e.playerId !== gameResult.sessionId);
      winRateEntries.push(winRateEntry);
      winRateEntries.sort((a: LeaderboardEntry, b: LeaderboardEntry) => b.value - a.value);
      leaderboards[winRateKey] = winRateEntries.slice(0, 100);

      let winRateGlobalEntries = leaderboards[winRateGlobalKey] || [];
      winRateGlobalEntries = winRateGlobalEntries.filter((e: LeaderboardEntry) => e.playerId !== gameResult.sessionId);
      winRateGlobalEntries.push(winRateEntry);
      winRateGlobalEntries.sort((a: LeaderboardEntry, b: LeaderboardEntry) => b.value - a.value);
      leaderboards[winRateGlobalKey] = winRateGlobalEntries.slice(0, 100);
    }

    lastUpdated = new Date();
  });

  // Query handler for getting leaderboard
  setHandler(getLeaderboardQuery, (query: LeaderboardQuery): LeaderboardResponse => {
    const { category = LeaderboardCategory.FASTEST_TIME, difficulty, limit = 10 } = query;
    const key = getLeaderboardKey(category, difficulty);
    const entries = leaderboards[key] || [];
    
    return {
      category,
      difficulty,
      entries: entries.slice(0, limit),
      lastUpdated
    };
  });

  // Query handler for getting player stats
  setHandler(getPlayerStatsQuery, (playerId: string): PlayerStats | null => {
    return playerStats[playerId] || null;
  });

  // Keep the workflow running indefinitely
  console.log('Leaderboard workflow started');
  
  try {
    // Run forever - this workflow manages the global leaderboard state
    await condition(() => false);
  } catch (error) {
    console.error('Error in leaderboard workflow:', error);
  }
} 
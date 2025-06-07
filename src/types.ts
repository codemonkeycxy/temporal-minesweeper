export interface Cell {
  isMine: boolean;
  isRevealed: boolean;
  isFlagged: boolean;
  neighborMines: number;
  row: number;
  col: number;
}

export interface GameBoard {
  cells: Cell[][];
  width: number;
  height: number;
  mineCount: number;
}

export enum GameStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  WON = 'WON',
  LOST = 'LOST',
  CLOSED = 'CLOSED'
}

export interface GameState {
  id: string;
  board: GameBoard;
  status: GameStatus;
  startTime?: Date;
  endTime?: Date;
  flagsUsed: number;
  cellsRevealed: number;
}

export interface MoveRequest {
  row: number;
  col: number;
  action: 'reveal' | 'flag' | 'unflag' | 'chord';
}

export interface GameConfig {
  width: number;
  height: number;
  mineCount: number;
}

export interface CreateGameRequest {
  config: GameConfig;
  sessionId?: string;
}

export interface GameResponse {
  gameState: GameState;
  message?: string;
}

export interface GameResult {
  id: string;
  sessionId: string;
  config: GameConfig;
  status: GameStatus;
  startTime: Date;
  endTime: Date;
  duration: number; // in seconds
  cellsRevealed: number;
  flagsUsed: number;
}

// Leaderboard types
export enum DifficultyLevel {
  BEGINNER = 'BEGINNER',     // 9x9, 10 mines
  INTERMEDIATE = 'INTERMEDIATE', // 16x16, 40 mines  
  EXPERT = 'EXPERT',         // 30x16, 99 mines
  CUSTOM = 'CUSTOM'          // Any other configuration
}

export enum LeaderboardCategory {
  FASTEST_TIME = 'FASTEST_TIME',
  MOST_WINS = 'MOST_WINS',
  BEST_WIN_RATE = 'BEST_WIN_RATE',
  TOTAL_GAMES = 'TOTAL_GAMES'
}

export interface LeaderboardEntry {
  playerId: string; // sessionId for now
  playerName?: string; // optional nickname
  value: number; // time in seconds, win count, etc.
  gameId: string;
  difficulty: DifficultyLevel;
  timestamp: Date;
  gameConfig: GameConfig;
  // Additional stats for context
  totalGames?: number;
  totalWins?: number;
  winRate?: number;
}

export interface PlayerStats {
  playerId: string;
  playerName?: string;
  totalGames: number;
  totalWins: number;
  winRate: number;
  bestTimes: { [difficulty: string]: number }; // difficulty -> best time in seconds
  lastPlayed: Date;
}

export interface LeaderboardQuery {
  category: LeaderboardCategory;
  difficulty?: DifficultyLevel;
  limit?: number; // default 10
}

export interface LeaderboardResponse {
  category: LeaderboardCategory;
  difficulty?: DifficultyLevel;
  entries: LeaderboardEntry[];
  lastUpdated: Date;
} 
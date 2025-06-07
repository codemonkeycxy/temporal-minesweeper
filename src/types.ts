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
  LOST = 'LOST'
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
}

export interface GameResponse {
  gameState: GameState;
  message?: string;
} 
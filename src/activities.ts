import { Cell, GameBoard, GameConfig, GameState, GameStatus, MoveRequest } from './types';

export async function createGameBoard(config: GameConfig): Promise<GameBoard> {
  const { width, height, mineCount } = config;
  
  // Initialize empty board
  const cells: Cell[][] = [];
  for (let row = 0; row < height; row++) {
    cells[row] = [];
    for (let col = 0; col < width; col++) {
      cells[row][col] = {
        isMine: false,
        isRevealed: false,
        isFlagged: false,
        neighborMines: 0,
        row,
        col
      };
    }
  }

  // Place mines randomly
  const positions = [];
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      positions.push({ row, col });
    }
  }
  
  // Fisher-Yates shuffle
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }

  // Place mines
  for (let i = 0; i < Math.min(mineCount, positions.length); i++) {
    const { row, col } = positions[i];
    cells[row][col].isMine = true;
  }

  // Calculate neighbor mine counts
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      if (!cells[row][col].isMine) {
        cells[row][col].neighborMines = countNeighborMines(cells, row, col, width, height);
      }
    }
  }

  return {
    cells,
    width,
    height,
    mineCount
  };
}

function countNeighborMines(cells: Cell[][], row: number, col: number, width: number, height: number): number {
  let count = 0;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const newRow = row + dr;
      const newCol = col + dc;
      if (newRow >= 0 && newRow < height && newCol >= 0 && newCol < width) {
        if (cells[newRow][newCol].isMine) {
          count++;
        }
      }
    }
  }
  return count;
}

export async function revealCell(gameState: GameState, row: number, col: number): Promise<GameState> {
  const cell = gameState.board.cells[row][col];
  
  if (cell.isRevealed || cell.isFlagged) {
    return gameState;
  }

  const newGameState = JSON.parse(JSON.stringify(gameState)); // Deep clone
  
  if (cell.isMine) {
    // Game over
    newGameState.status = GameStatus.LOST;
    newGameState.endTime = new Date();
    // Reveal all mines
    for (let r = 0; r < newGameState.board.height; r++) {
      for (let c = 0; c < newGameState.board.width; c++) {
        if (newGameState.board.cells[r][c].isMine) {
          newGameState.board.cells[r][c].isRevealed = true;
        }
      }
    }
  } else {
    // Reveal the cell and potentially cascade
    revealCellRecursive(newGameState.board.cells, row, col, newGameState.board.width, newGameState.board.height);
    
    // Count revealed cells
    let revealedCount = 0;
    for (let r = 0; r < newGameState.board.height; r++) {
      for (let c = 0; c < newGameState.board.width; c++) {
        if (newGameState.board.cells[r][c].isRevealed) {
          revealedCount++;
        }
      }
    }
    
    newGameState.cellsRevealed = revealedCount;
    
    // Check win condition
    const totalCells = newGameState.board.width * newGameState.board.height;
    if (revealedCount === totalCells - newGameState.board.mineCount) {
      newGameState.status = GameStatus.WON;
      newGameState.endTime = new Date();
    }
  }

  return newGameState;
}

function revealCellRecursive(cells: Cell[][], row: number, col: number, width: number, height: number): void {
  if (row < 0 || row >= height || col < 0 || col >= width) return;
  
  const cell = cells[row][col];
  if (cell.isRevealed || cell.isFlagged || cell.isMine) return;
  
  cell.isRevealed = true;
  
  // If this cell has no neighboring mines, reveal all neighbors
  if (cell.neighborMines === 0) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        revealCellRecursive(cells, row + dr, col + dc, width, height);
      }
    }
  }
}

export async function toggleFlag(gameState: GameState, row: number, col: number): Promise<GameState> {
  const cell = gameState.board.cells[row][col];
  
  if (cell.isRevealed) {
    return gameState;
  }

  const newGameState = JSON.parse(JSON.stringify(gameState)); // Deep clone
  const newCell = newGameState.board.cells[row][col];
  
  newCell.isFlagged = !newCell.isFlagged;
  
  // Update flag count
  let flagCount = 0;
  for (let r = 0; r < newGameState.board.height; r++) {
    for (let c = 0; c < newGameState.board.width; c++) {
      if (newGameState.board.cells[r][c].isFlagged) {
        flagCount++;
      }
    }
  }
  
  newGameState.flagsUsed = flagCount;
  
  return newGameState;
}

export async function chordReveal(gameState: GameState, row: number, col: number): Promise<GameState> {
  const cell = gameState.board.cells[row][col];
  
  // Can only chord on revealed cells with numbers
  if (!cell.isRevealed || cell.isMine || cell.neighborMines === 0) {
    return gameState;
  }

  const newGameState = JSON.parse(JSON.stringify(gameState)); // Deep clone
  
  // Count flagged neighbors and collect unflagged, unrevealed neighbors
  let flaggedCount = 0;
  const neighborsToReveal: { row: number; col: number }[] = [];
  
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      
      const newRow = row + dr;
      const newCol = col + dc;
      
      if (newRow >= 0 && newRow < gameState.board.height && 
          newCol >= 0 && newCol < gameState.board.width) {
        const neighbor = gameState.board.cells[newRow][newCol];
        
        if (neighbor.isFlagged) {
          flaggedCount++;
        } else if (!neighbor.isRevealed) {
          neighborsToReveal.push({ row: newRow, col: newCol });
        }
      }
    }
  }
  
  // Only proceed if flagged count matches the cell's number
  if (flaggedCount !== cell.neighborMines) {
    return gameState;
  }
  
  // Reveal all unflagged neighbors
  let hitMine = false;
  for (const neighbor of neighborsToReveal) {
    const neighborCell = newGameState.board.cells[neighbor.row][neighbor.col];
    
    if (neighborCell.isMine) {
      hitMine = true;
      neighborCell.isRevealed = true;
    } else {
      // Use recursive reveal for empty cells
      revealCellRecursive(newGameState.board.cells, neighbor.row, neighbor.col, 
                         newGameState.board.width, newGameState.board.height);
    }
  }
  
  if (hitMine) {
    // Game over - reveal all mines
    newGameState.status = GameStatus.LOST;
    newGameState.endTime = new Date();
    for (let r = 0; r < newGameState.board.height; r++) {
      for (let c = 0; c < newGameState.board.width; c++) {
        if (newGameState.board.cells[r][c].isMine) {
          newGameState.board.cells[r][c].isRevealed = true;
        }
      }
    }
  } else {
    // Count revealed cells and check win condition
    let revealedCount = 0;
    for (let r = 0; r < newGameState.board.height; r++) {
      for (let c = 0; c < newGameState.board.width; c++) {
        if (newGameState.board.cells[r][c].isRevealed) {
          revealedCount++;
        }
      }
    }
    
    newGameState.cellsRevealed = revealedCount;
    
    const totalCells = newGameState.board.width * newGameState.board.height;
    if (revealedCount === totalCells - newGameState.board.mineCount) {
      newGameState.status = GameStatus.WON;
      newGameState.endTime = new Date();
    }
  }

  return newGameState;
} 
class MinesweeperGame {
    constructor() {
        this.gameId = null;
        this.gameState = null;
        this.gameStartTime = null;
        this.timerInterval = null;
        
        // Mobile interaction state
        this.mobileMode = 'reveal'; // 'reveal' or 'flag'
        this.touchStartTime = 0;
        this.touchStartPos = { x: 0, y: 0 };
        this.longPressTimer = null;
        this.isLongPress = false;
        this.lastTapTime = 0;
        this.tapTimeout = null;
        
        this.initializeElements();
        this.attachEventListeners();
        this.updateCustomConfigVisibility();
        this.updateModeToggleButton();
    }

    initializeElements() {
        this.difficultySelect = document.getElementById('difficulty');
        this.customConfig = document.getElementById('custom-config');
        this.widthInput = document.getElementById('width');
        this.heightInput = document.getElementById('height');
        this.minesInput = document.getElementById('mines');
        this.newGameBtn = document.getElementById('new-game-btn');
        this.restartBtn = document.getElementById('restart-btn');
        this.gameStatus = document.getElementById('game-status');
        this.minesLeft = document.getElementById('mines-left');
        this.gameTime = document.getElementById('game-time');
        this.gameBoard = document.getElementById('game-board');
        this.modeToggleBtn = document.getElementById('mode-toggle-btn');
    }

    attachEventListeners() {
        this.difficultySelect.addEventListener('change', () => {
            this.updateCustomConfigVisibility();
            this.updateCustomInputs();
        });

        this.newGameBtn.addEventListener('click', () => this.createNewGame());
        this.restartBtn.addEventListener('click', () => this.restartGame());
        this.modeToggleBtn.addEventListener('click', () => this.toggleMobileMode());

        // Prevent middle-click scroll behavior on the entire game board area
        document.addEventListener('mousedown', (e) => {
            if (e.button === 1) {
                const gameBoard = document.getElementById('game-board');
                if (gameBoard && (gameBoard.contains(e.target) || e.target === gameBoard)) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }
        });

        document.addEventListener('mouseup', (e) => {
            if (e.button === 1) {
                const gameBoard = document.getElementById('game-board');
                if (gameBoard && (gameBoard.contains(e.target) || e.target === gameBoard)) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }
        });

        document.addEventListener('auxclick', (e) => {
            if (e.button === 1) {
                const gameBoard = document.getElementById('game-board');
                if (gameBoard && (gameBoard.contains(e.target) || e.target === gameBoard)) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }
        });
    }

    toggleMobileMode() {
        this.mobileMode = this.mobileMode === 'reveal' ? 'flag' : 'reveal';
        this.updateModeToggleButton();
    }

    updateModeToggleButton() {
        if (this.mobileMode === 'reveal') {
            this.modeToggleBtn.innerHTML = '<span class="mode-icon">👆</span><span class="mode-text">Reveal Mode</span>';
            this.modeToggleBtn.className = 'btn btn-mode reveal-mode';
        } else {
            this.modeToggleBtn.innerHTML = '<span class="mode-icon">🚩</span><span class="mode-text">Flag Mode</span>';
            this.modeToggleBtn.className = 'btn btn-mode flag-mode';
        }
        this.modeToggleBtn.dataset.mode = this.mobileMode;
    }

    updateCustomConfigVisibility() {
        const isCustom = this.difficultySelect.value === 'custom';
        this.customConfig.style.display = isCustom ? 'flex' : 'none';
    }

    updateCustomInputs() {
        const difficulty = this.difficultySelect.value;
        const configs = {
            beginner: { width: 9, height: 9, mines: 10 },
            intermediate: { width: 16, height: 16, mines: 40 },
            expert: { width: 30, height: 16, mines: 99 }
        };

        if (configs[difficulty]) {
            this.widthInput.value = configs[difficulty].width;
            this.heightInput.value = configs[difficulty].height;
            this.minesInput.value = configs[difficulty].mines;
        }
    }

    getGameConfig() {
        return {
            width: parseInt(this.widthInput.value),
            height: parseInt(this.heightInput.value),
            mineCount: parseInt(this.minesInput.value)
        };
    }

    async createNewGame() {
        try {
            this.newGameBtn.disabled = true;
            
            const config = this.getGameConfig();
            
            // Validate config
            if (config.mineCount >= config.width * config.height) {
                alert('Too many mines for the board size!');
                return;
            }

            const response = await fetch('/api/games', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ config }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create game');
            }

            const data = await response.json();
            this.gameId = data.gameState.id;
            
            // Poll until the game state is fully initialized
            await this.waitForGameInitialization();
            
            this.restartBtn.disabled = false;
            
        } catch (error) {
            console.error('Error creating game:', error);
            alert('Failed to create game: ' + error.message);
        } finally {
            this.newGameBtn.disabled = false;
        }
    }

    async waitForGameInitialization() {
        const maxAttempts = 20; // Maximum 2 seconds (20 * 100ms)
        let attempts = 0;
        
        while (attempts < maxAttempts) {
            try {
                const response = await fetch(`/api/games/${this.gameId}`);
                if (response.ok) {
                    const data = await response.json();
                    const gameState = data.gameState;
                    
                    // Check if board is fully initialized
                    if (gameState.board && 
                        gameState.board.cells && 
                        gameState.board.cells.length > 0 && 
                        gameState.board.cells[0] && 
                        gameState.board.cells[0].length > 0) {
                        // Board is ready!
                        this.updateGameState(gameState);
                        return;
                    }
                }
            } catch (error) {
                console.error('Error polling game state:', error);
            }
            
            // Wait 100ms before next attempt
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        // If we get here, initialization timed out
        throw new Error('Game initialization timed out');
    }

    async restartGame() {
        if (!this.gameId) return;

        try {
            this.restartBtn.disabled = true;
            
            const config = this.getGameConfig();
            
            const response = await fetch(`/api/games/${this.gameId}/restart`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ config }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to restart game');
            }

            const data = await response.json();
            this.updateGameState(data.gameState);
            
        } catch (error) {
            console.error('Error restarting game:', error);
            alert('Failed to restart game: ' + error.message);
        } finally {
            this.restartBtn.disabled = false;
        }
    }

    async makeMove(row, col, action) {
        if (!this.gameId || !this.gameState) return;
        
        if (this.gameState.status === 'WON' || this.gameState.status === 'LOST') {
            return; // Game is over
        }

        try {
            // Store the current state to detect changes
            const previousState = JSON.stringify(this.gameState);
            
            const response = await fetch(`/api/games/${this.gameId}/moves`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ row, col, action }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to make move');
            }

            // Poll for the updated game state
            await this.waitForMoveCompletion(previousState);
            
        } catch (error) {
            console.error('Error making move:', error);
            alert('Failed to make move: ' + error.message);
        }
    }

    async waitForMoveCompletion(previousState) {
        const maxAttempts = 10; // Maximum 1 second (10 * 100ms)
        let attempts = 0;
        
        while (attempts < maxAttempts) {
            try {
                const response = await fetch(`/api/games/${this.gameId}`);
                if (response.ok) {
                    const data = await response.json();
                    const gameState = data.gameState;
                    const currentState = JSON.stringify(gameState);
                    
                    // Check if the state has changed from the previous state
                    if (currentState !== previousState) {
                        // State has been updated - move was processed!
                        this.updateGameState(gameState);
                        return;
                    }
                }
            } catch (error) {
                console.error('Error polling game state after move:', error);
            }
            
            // Wait 100ms before next attempt
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        // If we get here, we couldn't detect the state change, but update anyway
        console.warn('Move completion polling timed out, updating with last known state');
        try {
            const response = await fetch(`/api/games/${this.gameId}`);
            if (response.ok) {
                const data = await response.json();
                this.updateGameState(data.gameState);
            }
        } catch (error) {
            console.error('Error getting final game state:', error);
        }
    }

    updateGameState(gameState) {
        this.gameState = gameState;
        this.updateUI();
        this.renderBoard();
        this.updateTimer();
    }

    updateUI() {
        // Update status
        const statusText = this.gameState.status.replace('_', ' ').toLowerCase();
        this.gameStatus.textContent = statusText.charAt(0).toUpperCase() + statusText.slice(1);
        this.gameStatus.className = `status ${this.gameState.status.toLowerCase().replace('_', '-')}`;

        // Update mines left
        const minesLeft = this.gameState.board.mineCount - this.gameState.flagsUsed;
        this.minesLeft.textContent = minesLeft;
    }

    updateTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }

        if (this.gameState.status === 'IN_PROGRESS' && this.gameState.startTime) {
            this.gameStartTime = new Date(this.gameState.startTime);
            this.timerInterval = setInterval(() => {
                const now = new Date();
                const elapsed = Math.floor((now - this.gameStartTime) / 1000);
                const minutes = Math.floor(elapsed / 60);
                const seconds = elapsed % 60;
                this.gameTime.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }, 1000);
        } else if (this.gameState.status === 'WON' || this.gameState.status === 'LOST') {
            if (this.gameState.startTime && this.gameState.endTime) {
                const elapsed = Math.floor((new Date(this.gameState.endTime) - new Date(this.gameState.startTime)) / 1000);
                const minutes = Math.floor(elapsed / 60);
                const seconds = elapsed % 60;
                this.gameTime.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
        } else {
            this.gameTime.textContent = '00:00';
        }
    }

    renderBoard() {
        if (!this.gameState || !this.gameState.board) {
            return;
        }

        const board = this.gameState.board;
        
        // Check if board is properly initialized
        if (!board.cells || board.cells.length === 0 || !board.cells[0] || board.cells[0].length === 0) {
            // Board not ready yet, show loading message
            this.gameBoard.innerHTML = '<div class="no-game"><p>Initializing game...</p></div>';
            return;
        }
        
        // Clear previous board
        this.gameBoard.innerHTML = '';

        // Create board container
        const boardContainer = document.createElement('div');
        boardContainer.className = 'board';
        boardContainer.style.gridTemplateColumns = `repeat(${board.width}, 1fr)`;
        boardContainer.style.gridTemplateRows = `repeat(${board.height}, 1fr)`;

        // Create cells
        for (let row = 0; row < board.height; row++) {
            for (let col = 0; col < board.width; col++) {
                const cell = board.cells[row][col];
                const cellElement = document.createElement('button');
                cellElement.className = 'cell';
                cellElement.dataset.row = row;
                cellElement.dataset.col = col;

                // Set cell content and classes
                if (cell.isRevealed) {
                    cellElement.classList.add('revealed');
                    if (cell.isMine) {
                        cellElement.classList.add('mine');
                        cellElement.textContent = '💣';
                    } else if (cell.neighborMines > 0) {
                        cellElement.textContent = cell.neighborMines;
                        cellElement.classList.add(`n${cell.neighborMines}`);
                    }
                } else if (cell.isFlagged) {
                    cellElement.classList.add('flagged');
                    cellElement.textContent = '🚩';
                }

                // Add event listeners
                this.addCellEventListeners(cellElement, row, col, cell);

                boardContainer.appendChild(cellElement);
            }
        }

        this.gameBoard.appendChild(boardContainer);
    }

    addCellEventListeners(cellElement, row, col, cell) {
        // Desktop mouse events
        cellElement.addEventListener('click', (e) => {
            e.preventDefault();
            if (!cell.isRevealed && !cell.isFlagged) {
                this.makeMove(row, col, 'reveal');
            }
        });

        cellElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (!cell.isRevealed) {
                const action = cell.isFlagged ? 'unflag' : 'flag';
                this.makeMove(row, col, action);
            }
        });

        // Add middle-click for chord reveal on numbered cells
        cellElement.addEventListener('auxclick', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.button === 1 && cell.isRevealed && !cell.isMine && cell.neighborMines > 0) {
                // Middle click on revealed numbered cell - chord reveal
                this.makeMove(row, col, 'chord');
            }
        });

        // Additional event handlers to prevent browser scroll on middle-click
        cellElement.addEventListener('mousedown', (e) => {
            if (e.button === 1) {
                e.preventDefault();
                e.stopPropagation();
            }
        });

        cellElement.addEventListener('mouseup', (e) => {
            if (e.button === 1) {
                e.preventDefault();
                e.stopPropagation();
            }
        });

        // Mobile touch events
        cellElement.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handleTouchStart(e, row, col, cell);
        });

        cellElement.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.handleTouchEnd(e, row, col, cell);
        });

        cellElement.addEventListener('touchmove', (e) => {
            e.preventDefault();
            // Cancel long press if finger moves too much
            const touch = e.touches[0];
            const deltaX = Math.abs(touch.clientX - this.touchStartPos.x);
            const deltaY = Math.abs(touch.clientY - this.touchStartPos.y);
            if (deltaX > 10 || deltaY > 10) {
                this.cancelLongPress();
            }
        });

        cellElement.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            this.cancelLongPress();
        });
    }

    handleTouchStart(e, row, col, cell) {
        const touch = e.touches[0];
        this.touchStartTime = Date.now();
        this.touchStartPos = { x: touch.clientX, y: touch.clientY };
        this.isLongPress = false;

        // Start long press timer (500ms)
        this.longPressTimer = setTimeout(() => {
            this.isLongPress = true;
            // Long press action - always flag/unflag
            if (!cell.isRevealed) {
                const action = cell.isFlagged ? 'unflag' : 'flag';
                this.makeMove(row, col, action);
                // Haptic feedback if available
                if ('vibrate' in navigator) {
                    navigator.vibrate(50);
                }
            }
        }, 500);
    }

    handleTouchEnd(e, row, col, cell) {
        this.cancelLongPress();

        if (this.isLongPress) {
            // Long press was handled in timer
            return;
        }

        const touchDuration = Date.now() - this.touchStartTime;
        if (touchDuration > 500) {
            // This was a long press, ignore
            return;
        }

        // Handle tap or double tap
        const now = Date.now();
        const timeSinceLastTap = now - this.lastTapTime;
        
        if (timeSinceLastTap < 300) {
            // Double tap - chord reveal on numbered cells
            if (this.tapTimeout) {
                clearTimeout(this.tapTimeout);
                this.tapTimeout = null;
            }
            
            if (cell.isRevealed && !cell.isMine && cell.neighborMines > 0) {
                this.makeMove(row, col, 'chord');
            }
            this.lastTapTime = 0; // Reset to prevent triple-tap issues
        } else {
            // Single tap - but wait to see if it becomes a double tap
            this.lastTapTime = now;
            this.tapTimeout = setTimeout(() => {
                this.handleSingleTap(row, col, cell);
                this.tapTimeout = null;
            }, 300);
        }
    }

    handleSingleTap(row, col, cell) {
        if (this.mobileMode === 'reveal') {
            // Reveal mode - tap to reveal
            if (!cell.isRevealed && !cell.isFlagged) {
                this.makeMove(row, col, 'reveal');
            }
        } else {
            // Flag mode - tap to flag/unflag
            if (!cell.isRevealed) {
                const action = cell.isFlagged ? 'unflag' : 'flag';
                this.makeMove(row, col, action);
            }
        }
    }

    cancelLongPress() {
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new MinesweeperGame();
}); 
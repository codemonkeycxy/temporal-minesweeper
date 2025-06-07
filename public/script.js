class MinesweeperGame {
    constructor() {
        this.gameId = null;
        this.gameState = null;
        this.gameStartTime = null;
        this.timerInterval = null;
        this.sessionId = this.getOrCreateSessionId();
        
        // Mobile interaction state
        this.touchStartTime = 0;
        this.touchStartPos = { x: 0, y: 0 };
        this.longPressTimer = null;
        this.isLongPress = false;
        this.lastTapTime = 0;
        this.tapTimeout = null;
        
        this.initializeElements();
        this.attachEventListeners();
        this.updateCustomConfigVisibility();
        
        // Initialize i18n before trying to resume game
        this.initializeI18n();
        
        // Listen for language change events to update dynamic content
        window.addEventListener('i18n-updated', () => {
            this.updateDynamicContent();
        });
    }

    async initializeI18n() {
        try {
            await window.i18n.initWithPreference();
            console.log('I18n initialized successfully');
            
            // Set the language selector to match the detected/saved language
            this.languageSelect.value = window.i18n.getCurrentLanguage();
            
            // Update select options with translations
            this.updateSelectOptions();
            
            // Now that i18n is ready, load other game components
            this.tryResumeGame();
            this.loadGameHistory();
            this.initializeLeaderboard();
        } catch (error) {
            console.error('Failed to initialize i18n:', error);
            // Fallback: still try to load the game
            this.tryResumeGame();
            this.loadGameHistory();
            this.initializeLeaderboard();
        }
    }

    updateSelectOptions() {
        // Update difficulty selector options
        const difficultyOptions = this.difficultySelect.querySelectorAll('option');
        difficultyOptions.forEach(option => {
            const key = option.getAttribute('data-i18n');
            if (key) {
                option.textContent = window.i18n.t(key);
            }
        });

        // Update leaderboard category options
        const categorySelect = document.getElementById('leaderboard-category');
        if (categorySelect) {
            const categoryOptions = categorySelect.querySelectorAll('option');
            categoryOptions.forEach(option => {
                const key = option.getAttribute('data-i18n');
                if (key) {
                    option.textContent = window.i18n.t(key);
                }
            });
        }

        // Update leaderboard difficulty options
        const leaderboardDifficultySelect = document.getElementById('leaderboard-difficulty');
        if (leaderboardDifficultySelect) {
            const difficultyOptions = leaderboardDifficultySelect.querySelectorAll('option');
            difficultyOptions.forEach(option => {
                const key = option.getAttribute('data-i18n');
                if (key) {
                    option.textContent = window.i18n.t(key);
                }
            });
        }
    }

    updateDynamicContent() {
        // Update game history title if it exists
        const historyContainer = document.getElementById('game-history');
        if (historyContainer) {
            const title = historyContainer.querySelector('h3');
            if (title) {
                title.textContent = window.i18n.t('gameHistory.title');
            }
            
            // Update "no games" message if it exists
            const noGamesMsg = historyContainer.querySelector('.no-history');
            if (noGamesMsg) {
                noGamesMsg.textContent = window.i18n.t('gameHistory.noGames');
            }
        }

        // Update leaderboard loading/no entries messages if visible
        const leaderboardContent = document.getElementById('leaderboard-content');
        if (leaderboardContent) {
            const loading = leaderboardContent.querySelector('.loading');
            if (loading) {
                loading.textContent = window.i18n.t('leaderboard.loading');
            }
            
            const noLeaderboard = leaderboardContent.querySelector('.no-leaderboard');
            if (noLeaderboard) {
                noLeaderboard.textContent = window.i18n.t('leaderboardMessages.noEntries');
            }
        }
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
        this.languageSelect = document.getElementById('language-select');
    }

    attachEventListeners() {
        this.difficultySelect.addEventListener('change', () => {
            this.updateCustomConfigVisibility();
            this.updateCustomInputs();
        });

        this.newGameBtn.addEventListener('click', () => this.createNewGame());
        this.restartBtn.addEventListener('click', () => this.restartGame());

        // Language selector
        this.languageSelect.addEventListener('change', async (e) => {
            const selectedLanguage = e.target.value;
            const success = await window.i18n.changeLanguage(selectedLanguage);
            if (success) {
                // Update any dynamic content that might not be automatically updated
                if (this.gameState) {
                    this.updateUI();
                }
                // Update option texts in selectors
                this.updateSelectOptions();
            }
        });

        // Handle window resize for responsive board sizing
        let resizeTimeout;
        window.addEventListener('resize', () => {
            // Debounce resize events to avoid excessive calculations
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if (this.gameState && this.gameState.board) {
                    this.renderBoard();
                }
            }, 100);
        });
    }

    updateCustomConfigVisibility() {
        const isCustom = this.difficultySelect.value === 'custom';
        this.customConfig.style.display = isCustom ? 'flex' : 'none';
    }

    // localStorage management for game resuming
    saveGameId(gameId) {
        try {
            localStorage.setItem('minesweeper-current-game', gameId);
        } catch (error) {
            console.warn('Failed to save game ID to localStorage:', error);
        }
    }

    getSavedGameId() {
        try {
            return localStorage.getItem('minesweeper-current-game');
        } catch (error) {
            console.warn('Failed to get saved game ID from localStorage:', error);
            return null;
        }
    }

    clearSavedGame() {
        try {
            localStorage.removeItem('minesweeper-current-game');
        } catch (error) {
            console.warn('Failed to clear saved game from localStorage:', error);
        }
    }

    async tryResumeGame() {
        const savedGameId = this.getSavedGameId();
        if (!savedGameId) {
            return; // No saved game
        }

        try {
            // Try to load the saved game
            const response = await fetch(`/api/games/${savedGameId}`);
            if (!response.ok) {
                // Game no longer exists, clear it
                this.clearSavedGame();
                return;
            }

            const data = await response.json();
            const gameState = data.gameState;

            // Check if game is still resumable (not closed)
            if (gameState.status === 'CLOSED') {
                this.clearSavedGame();
                return;
            }

            // Resume the game
            this.gameId = savedGameId;
            this.updateGameState(gameState);
            this.restartBtn.disabled = false;
            
            console.log('Successfully resumed game:', savedGameId);
        } catch (error) {
            console.warn('Failed to resume saved game:', error);
            this.clearSavedGame();
        }
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
            
            // Clear any previously saved game since we're starting fresh
            this.clearSavedGame();
            
            const config = this.getGameConfig();
            
            // Validate config
            if (config.mineCount >= config.width * config.height) {
                alert(window.i18n.t('errors.tooManyMines'));
                return;
            }

            const response = await fetch('/api/games', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ config, sessionId: this.sessionId }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create game');
            }

            const data = await response.json();
            this.gameId = data.gameState.id;
            
            // Save the new game ID for resuming
            this.saveGameId(this.gameId);
            
            // Poll until the game state is fully initialized
            await this.waitForGameInitialization();
            
            this.restartBtn.disabled = false;
            
        } catch (error) {
            console.error('Error creating game:', error);
            alert(window.i18n.t('errors.failedToCreate') + ' ' + error.message);
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
        throw new Error(window.i18n.t('errors.initTimeout'));
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
            
            // Save the game ID again since we have a fresh, resumable game
            this.saveGameId(this.gameId);
            
            this.updateGameState(data.gameState);
            
        } catch (error) {
            console.error('Error restarting game:', error);
            alert(window.i18n.t('errors.failedToRestart') + ' ' + error.message);
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
            alert(window.i18n.t('errors.failedToMove') + ' ' + error.message);
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
        
        // Clear saved game if it's finished
        if (gameState.status === 'WON' || gameState.status === 'LOST' || gameState.status === 'CLOSED') {
            this.clearSavedGame();
            // Reload game history when a game finishes
            setTimeout(() => this.loadGameHistory(), 1000);
            // Refresh leaderboard if game was won
            if (gameState.status === 'WON') {
                setTimeout(() => this.loadLeaderboard(), 1500);
            }
        }
    }

    updateUI() {
        // Update status with translation
        let statusKey = '';
        switch (this.gameState.status) {
            case 'NOT_STARTED':
                statusKey = 'game.notStarted';
                break;
            case 'IN_PROGRESS':
                statusKey = 'game.inProgress';
                break;
            case 'WON':
                statusKey = 'game.won';
                break;
            case 'LOST':
                statusKey = 'game.lost';
                break;
            default:
                statusKey = 'game.notStarted';
        }
        
        this.gameStatus.textContent = window.i18n.t(statusKey);
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

    calculateResponsiveCellSize(boardWidth, boardHeight) {
        // Get available width for the board
        const gameBoard = this.gameBoard;
        const gameBoardRect = gameBoard.getBoundingClientRect();
        const availableWidth = gameBoardRect.width - 40; // Account for padding
        const availableHeight = window.innerHeight * 0.6; // Use max 60% of viewport height
        
        // Calculate cell size based on available space
        const maxCellWidthFromWidth = Math.floor(availableWidth / boardWidth);
        const maxCellHeightFromHeight = Math.floor(availableHeight / boardHeight);
        
        // Use the smaller dimension to ensure the board fits
        let cellSize = Math.min(maxCellWidthFromWidth, maxCellHeightFromHeight);
        
        // Set reasonable min/max cell sizes
        const minCellSize = 20; // Minimum for usability
        const maxCellSize = 35; // Maximum for desktop
        
        cellSize = Math.max(minCellSize, Math.min(maxCellSize, cellSize));
        
        // Adjust font size based on cell size
        const fontSize = Math.max(10, Math.floor(cellSize * 0.4));
        
        return { cellSize, fontSize };
    }

    renderBoard() {
        if (!this.gameState || !this.gameState.board) {
            return;
        }

        const board = this.gameState.board;
        
        // Check if board is properly initialized
        if (!board.cells || board.cells.length === 0 || !board.cells[0] || board.cells[0].length === 0) {
            // Board not ready yet, show loading message
            this.gameBoard.innerHTML = `<div class="no-game"><p>${window.i18n.t('game.initializing')}</p></div>`;
            return;
        }
        
        // Clear previous board
        this.gameBoard.innerHTML = '';

        // Calculate responsive cell size
        const { cellSize, fontSize } = this.calculateResponsiveCellSize(board.width, board.height);

        // Create board container
        const boardContainer = document.createElement('div');
        boardContainer.className = 'board';
        boardContainer.style.gridTemplateColumns = `repeat(${board.width}, ${cellSize}px)`;
        boardContainer.style.gridTemplateRows = `repeat(${board.height}, ${cellSize}px)`;
        boardContainer.style.gap = '1px';

        // Create cells
        for (let row = 0; row < board.height; row++) {
            for (let col = 0; col < board.width; col++) {
                const cell = board.cells[row][col];
                const cellElement = document.createElement('button');
                cellElement.className = 'cell';
                cellElement.dataset.row = row;
                cellElement.dataset.col = col;
                
                // Apply responsive sizing
                cellElement.style.width = `${cellSize}px`;
                cellElement.style.height = `${cellSize}px`;
                cellElement.style.fontSize = `${fontSize}px`;

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

        // Add double-click for chord reveal on numbered cells
        cellElement.addEventListener('dblclick', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (cell.isRevealed && !cell.isMine && cell.neighborMines > 0) {
                // Double click on revealed numbered cell - chord reveal
                this.makeMove(row, col, 'chord');
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
        // Tap to reveal (long press handles flagging)
        if (!cell.isRevealed && !cell.isFlagged) {
            this.makeMove(row, col, 'reveal');
        }
    }

    cancelLongPress() {
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
    }

    // Session ID management
    getOrCreateSessionId() {
        try {
            let sessionId = sessionStorage.getItem('minesweeper-session-id');
            if (!sessionId) {
                sessionId = this.generateUUID();
                sessionStorage.setItem('minesweeper-session-id', sessionId);
            }
            return sessionId;
        } catch (error) {
            console.warn('Failed to manage session ID:', error);
            return this.generateUUID();
        }
    }

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // Load and display game history
    async loadGameHistory() {
        try {
            const response = await fetch(`/api/sessions/${this.sessionId}/games`);
            if (!response.ok) {
                console.warn('Failed to load game history');
                return;
            }
            
            const data = await response.json();
            this.displayGameHistory(data.games);
        } catch (error) {
            console.error('Error loading game history:', error);
        }
    }

    displayGameHistory(games) {
        let historyContainer = document.getElementById('game-history');
        if (!historyContainer) {
            // Create history container if it doesn't exist
            historyContainer = document.createElement('div');
            historyContainer.id = 'game-history';
            historyContainer.className = 'game-history';
            
            const title = document.createElement('h3');
            title.textContent = window.i18n.t('gameHistory.title');
            historyContainer.appendChild(title);
            
            // Insert after the game board
            const gameBoard = document.getElementById('game-board');
            gameBoard.parentNode.insertBefore(historyContainer, gameBoard.nextSibling);
        }

        // Clear previous history (keep the title)
        const title = historyContainer.querySelector('h3');
        historyContainer.innerHTML = '';
        historyContainer.appendChild(title);

        if (games.length === 0) {
            const noGames = document.createElement('p');
            noGames.textContent = window.i18n.t('gameHistory.noGames');
            noGames.className = 'no-history';
            historyContainer.appendChild(noGames);
            return;
        }

        const historyList = document.createElement('div');
        historyList.className = 'history-list';

        games.forEach(game => {
            const gameItem = document.createElement('div');
            gameItem.className = `history-item ${game.status.toLowerCase()}`;
            
            const result = game.status === 'WON' ? '🏆 Won' : '💥 Lost';
            const duration = this.formatDuration(game.duration);
            const difficulty = this.getDifficultyName(game.config);
            const date = new Date(game.endTime).toLocaleString();
            
            gameItem.innerHTML = `
                <div class="history-main">
                    <span class="history-result">${result}</span>
                    <span class="history-difficulty">${difficulty}</span>
                    <span class="history-duration">${duration}</span>
                </div>
                <div class="history-details">
                    <span class="history-date">${date}</span>
                    <span class="history-stats">Cells: ${game.cellsRevealed}, Flags: ${game.flagsUsed}</span>
                </div>
            `;
            
            historyList.appendChild(gameItem);
        });

        historyContainer.appendChild(historyList);
    }

    formatDuration(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    getDifficultyName(config) {
        if (config.width === 9 && config.height === 9 && config.mineCount === 10) {
            return 'Beginner';
        } else if (config.width === 16 && config.height === 16 && config.mineCount === 40) {
            return 'Intermediate';
        } else if (config.width === 30 && config.height === 16 && config.mineCount === 99) {
            return 'Expert';
        } else {
            return `Custom (${config.width}×${config.height}, ${config.mineCount} mines)`;
        }
    }

    // Leaderboard functionality
    initializeLeaderboard() {
        const categorySelect = document.getElementById('leaderboard-category');
        const difficultySelect = document.getElementById('leaderboard-difficulty');
        const refreshBtn = document.getElementById('refresh-leaderboard');

        // Event listeners for leaderboard controls
        categorySelect.addEventListener('change', () => this.loadLeaderboard());
        difficultySelect.addEventListener('change', () => this.loadLeaderboard());
        refreshBtn.addEventListener('click', () => this.loadLeaderboard());

        // Load initial leaderboard
        this.loadLeaderboard();
    }

    async loadLeaderboard() {
        const categorySelect = document.getElementById('leaderboard-category');
        const difficultySelect = document.getElementById('leaderboard-difficulty');
        const content = document.getElementById('leaderboard-content');

        // Show loading state
        content.innerHTML = `<div class="loading">${window.i18n.t('leaderboard.loading')}</div>`;

        try {
            const category = categorySelect.value;
            const difficulty = difficultySelect.value;
            const limit = 10;

            const url = new URL('/api/leaderboard', window.location.origin);
            url.searchParams.set('category', category);
            url.searchParams.set('limit', limit);
            if (difficulty) {
                url.searchParams.set('difficulty', difficulty);
            }

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Failed to load leaderboard');
            }

            const leaderboard = await response.json();
            this.displayLeaderboard(leaderboard);

        } catch (error) {
            console.error('Error loading leaderboard:', error);
            content.innerHTML = '<div class="no-leaderboard">Failed to load leaderboard. Please try again.</div>';
        }
    }

    displayLeaderboard(leaderboard) {
        const content = document.getElementById('leaderboard-content');

        if (!leaderboard.entries || leaderboard.entries.length === 0) {
            content.innerHTML = `<div class="no-leaderboard">${window.i18n.t('leaderboardMessages.noEntries')}</div>`;
            return;
        }

        const table = document.createElement('table');
        table.className = 'leaderboard-table';

        // Create table header
        const header = document.createElement('thead');
        const headerRow = document.createElement('tr');
        
        let valueHeader = 'Score';
        if (leaderboard.category === 'FASTEST_TIME') {
            valueHeader = 'Time';
        } else if (leaderboard.category === 'MOST_WINS') {
            valueHeader = 'Wins';
        } else if (leaderboard.category === 'BEST_WIN_RATE') {
            valueHeader = 'Win Rate';
        }

        headerRow.innerHTML = `
            <th class="leaderboard-rank">Rank</th>
            <th class="leaderboard-player">Player</th>
            <th class="leaderboard-value">${valueHeader}</th>
            <th class="leaderboard-difficulty">Difficulty</th>
            <th class="leaderboard-timestamp">Date</th>
        `;
        header.appendChild(headerRow);
        table.appendChild(header);

        // Create table body
        const body = document.createElement('tbody');
        leaderboard.entries.forEach((entry, index) => {
            const row = document.createElement('tr');
            
            const rank = index + 1;
            let rankClass = 'leaderboard-rank';
            if (rank === 1) rankClass += ' gold';
            else if (rank === 2) rankClass += ' silver';
            else if (rank === 3) rankClass += ' bronze';

            let valueDisplay = entry.value;
            if (leaderboard.category === 'FASTEST_TIME') {
                valueDisplay = this.formatDuration(entry.value);
            } else if (leaderboard.category === 'BEST_WIN_RATE') {
                valueDisplay = `${entry.value}%`;
            }

            const playerDisplay = entry.playerId.substring(0, 8) + '...'; // Show first 8 chars of session ID
            const difficultyDisplay = this.getDifficultyDisplayName(entry.difficulty);
            const dateDisplay = new Date(entry.timestamp).toLocaleDateString();

            row.innerHTML = `
                <td class="${rankClass}">${rank}</td>
                <td class="leaderboard-player" title="${entry.playerId}">${playerDisplay}</td>
                <td class="leaderboard-value">${valueDisplay}</td>
                <td class="leaderboard-difficulty">${difficultyDisplay}</td>
                <td class="leaderboard-timestamp">${dateDisplay}</td>
            `;

            // Highlight current player's entries
            if (entry.playerId === this.sessionId) {
                row.style.backgroundColor = '#e8f5e8';
                row.style.fontWeight = 'bold';
            }

            body.appendChild(row);
        });

        table.appendChild(body);
        content.innerHTML = '';
        content.appendChild(table);
    }

    getDifficultyDisplayName(difficulty) {
        switch (difficulty) {
            case 'BEGINNER': return 'Beginner';
            case 'INTERMEDIATE': return 'Intermediate';
            case 'EXPERT': return 'Expert';
            case 'CUSTOM': return 'Custom';
            default: return difficulty;
        }
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new MinesweeperGame();
}); 
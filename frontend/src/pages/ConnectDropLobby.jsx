import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';
import {
  CONNECT_DROP_ROWS,
  CONNECT_DROP_COLS,
  createEmptyGrid,
  findDropRow,
  checkConnectDropWinner,
  computeBestConnectDropMove,
  createConnectDropRoom,
  joinConnectDropRoom,
  getConnectDropRoomStatus,
  queueQuickMatch,
} from '../services/connectdropApi';
import { connectdropSocket } from '../services/connectdropSocket';
import './ConnectDropLobby.css';

const TURN_TIME_LIMIT = 20;

const playTone = (freq, duration, type = 'sine') => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Audio context may be restricted by autoplay policy
  }
};

const ConnectDropLobby = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  // Navigation / Views: 'LOBBY' | 'WAITING_ROOM' | 'PLAYING'
  const [view, setView] = useState('LOBBY');
  const [gameMode, setGameMode] = useState('VS_AI'); // 'VS_AI' | 'QUICK_MATCH' | 'PRIVATE'

  // Room & Identity
  const [roomCode, setRoomCode] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState(() => {
    return (searchParams.get('room') || '').trim().toUpperCase();
  });
  const [myColor, setMyColor] = useState('RED'); // 'RED' or 'YELLOW'
  const [playerRedName, setPlayerRedName] = useState('Player 1');
  const [playerYellowName, setPlayerYellowName] = useState('Player 2');
  const [isAiOpponent, setIsAiOpponent] = useState(false);
  const [scores, setScores] = useState({ RED: 0, YELLOW: 0 });

  // Board state (6 rows x 7 cols)
  const [grid, setGrid] = useState(createEmptyGrid);
  const [currentTurn, setCurrentTurn] = useState('RED'); // 'RED' always drops first
  const [turnTimer, setTurnTimer] = useState(TURN_TIME_LIMIT);
  const [winner, setWinner] = useState(null); // 'RED' | 'YELLOW' | 'DRAW' | null
  const [winningCells, setWinningCells] = useState(null); // array of [r, c]
  const [isGameOver, setIsGameOver] = useState(false);
  const [lastDroppedCell, setLastDroppedCell] = useState(null); // [r, c]

  // Hover indicator
  const [hoveredCol, setHoveredCol] = useState(null);

  // UI helpers
  const [statusMessage, setStatusMessage] = useState('');
  const [toast, setToast] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Synchronized refs for timers and WS callbacks
  const gridRef = useRef(grid);
  const currentTurnRef = useRef(currentTurn);
  const isGameOverRef = useRef(isGameOver);
  const myColorRef = useRef(myColor);
  const gameModeRef = useRef(gameMode);
  const sessionIdRef = useRef(sessionId);

  useEffect(() => {
    gridRef.current = grid;
    currentTurnRef.current = currentTurn;
    isGameOverRef.current = isGameOver;
    myColorRef.current = myColor;
    gameModeRef.current = gameMode;
    sessionIdRef.current = sessionId;
  }, [grid, currentTurn, isGameOver, myColor, gameMode, sessionId]);

  const [localGuestId] = useState(
    () => 'GUEST_' + Math.floor(1000 + Math.random() * 9000)
  );
  const playerId = user?.userId || localGuestId;
  const playerName = user?.displayName || 'Player';

  // Display Toast helper
  const showToast = useCallback((msg, type = 'info') => {
    setToast({ msg, type, id: Date.now() });
    setTimeout(() => {
      setToast((curr) => (curr && curr.msg === msg ? null : curr));
    }, 3200);
  }, []);

  // Celebration fireworks
  const triggerCelebration = useCallback(() => {
    try {
      confetti({
        particleCount: 150,
        spread: 85,
        origin: { y: 0.6 },
        colors: ['#ff4b5c', '#fddb3a', '#00f2fe', '#ffffff', '#e94560'],
      });
    } catch {
      // Ignore confetti errors
    }
  }, []);

  // Handle Game Over
  const handleGameOver = useCallback(
    (winResult) => {
      setIsGameOver(true);
      setWinner(winResult.winner);
      setWinningCells(winResult.winningCells);

      if (winResult.winner === 'DRAW') {
        setStatusMessage("🤝 STALEMATE! Grid is completely filled with no 4-in-a-row.");
        showToast("Game ended in a Draw!", 'info');
        if (soundEnabled) playTone(300, 0.4, 'triangle');
      } else {
        const isMe = winResult.winner === myColorRef.current;
        setScores((prev) => ({
          ...prev,
          [winResult.winner]: prev[winResult.winner] + 1,
        }));

        if (isMe) {
          triggerCelebration();
          setStatusMessage('🎉 VICTORY! You connected 4 discs and claimed the grid!');
          showToast('🎉 Victory! You won the duel!', 'success');
          if (soundEnabled) {
            playTone(523.25, 0.15);
            setTimeout(() => playTone(659.25, 0.2), 150);
            setTimeout(() => playTone(783.99, 0.35), 300);
          }
        } else {
          setStatusMessage(`💀 DEFEAT! ${winResult.winner === 'RED' ? playerRedName : playerYellowName} connected 4 discs!`);
          showToast(`Game Over: ${winResult.winner} wins!`, 'warning');
          if (soundEnabled) {
            playTone(220, 0.3, 'sawtooth');
            setTimeout(() => playTone(180, 0.4, 'sawtooth'), 250);
          }
        }
      }
    },
    [triggerCelebration, showToast, soundEnabled, playerRedName, playerYellowName]
  );

  // Execute drop into column
  const executeDrop = useCallback(
    (col, color) => {
      const current = gridRef.current;
      const targetRow = findDropRow(current, col);
      if (targetRow === -1) {
        showToast('Column is completely full! Pick another column.', 'warning');
        return false;
      }

      const nextGrid = current.map((row) => [...row]);
      nextGrid[targetRow][col] = color;
      setGrid(nextGrid);
      setLastDroppedCell([targetRow, col]);

      if (soundEnabled) {
        playTone(350 + (CONNECT_DROP_ROWS - targetRow) * 60, 0.12, 'sine');
      }

      const outcome = checkConnectDropWinner(nextGrid);
      if (outcome) {
        handleGameOver(outcome);
      } else {
        const nextColor = color === 'RED' ? 'YELLOW' : 'RED';
        setCurrentTurn(nextColor);
        setTurnTimer(TURN_TIME_LIMIT);
        setStatusMessage(
          nextColor === myColorRef.current
            ? 'Your turn! Drop a disc into any open column.'
            : `${nextColor === 'RED' ? playerRedName : playerYellowName}'s turn to drop...`
        );
      }
      return true;
    },
    [handleGameOver, showToast, soundEnabled, playerRedName, playerYellowName]
  );

  // AI Move Scheduler
  const scheduleAiMove = useCallback(
    (activeGrid, aiColor) => {
      setStatusMessage('🤖 Cyber AI is calculating optimal drop...');
      setTimeout(() => {
        if (isGameOverRef.current) return;
        const bestCol = computeBestConnectDropMove(activeGrid, aiColor);
        if (bestCol !== -1) {
          executeDrop(bestCol, aiColor);
        }
      }, 650);
    },
    [executeDrop]
  );

  // Handle local player drop action
  const handleColumnClick = (col) => {
    if (isGameOver) return;
    if (currentTurn !== myColor) {
      showToast("Hold on! It's your opponent's turn.", 'warning');
      return;
    }

    const targetRow = findDropRow(grid, col);
    if (targetRow === -1) {
      showToast('Column is full! Choose another column.', 'warning');
      return;
    }

    // If online multiplayer, publish through WebSocket
    if (gameMode !== 'VS_AI' && sessionId) {
      connectdropSocket.dropDisc(sessionId, playerId, col);
    }

    // Always perform the drop locally for responsive immediate action
    const success = executeDrop(col, myColor);

    // If Solo AI is playing, schedule AI reply
    if (success && isAiOpponent) {
      const nextGrid = grid.map((r) => [...r]);
      nextGrid[targetRow][col] = myColor;
      const outcome = checkConnectDropWinner(nextGrid);
      if (!outcome) {
        scheduleAiMove(nextGrid, myColor === 'RED' ? 'YELLOW' : 'RED');
      }
    }
  };

  // Turn Countdown Timer
  useEffect(() => {
    if (view !== 'PLAYING' || isGameOver) return;

    const timer = setInterval(() => {
      setTurnTimer((prev) => {
        if (prev <= 1) {
          // Timeout: auto-drop a random open column to keep the game flowing
          const availableCols = [];
          for (let c = 0; c < CONNECT_DROP_COLS; c++) {
            if (findDropRow(gridRef.current, c) !== -1) {
              availableCols.push(c);
            }
          }
          if (availableCols.length > 0 && currentTurnRef.current === myColorRef.current) {
            const randomCol = availableCols[Math.floor(Math.random() * availableCols.length)];
            executeDrop(randomCol, myColorRef.current);
            showToast('Time expired! Disc dropped automatically.', 'warning');
          }
          return TURN_TIME_LIMIT;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [view, isGameOver, executeDrop, showToast]);

  // Restart / Rematch
  const restartGame = useCallback(() => {
    const empty = createEmptyGrid();
    setGrid(empty);
    setCurrentTurn('RED');
    setIsGameOver(false);
    setWinner(null);
    setWinningCells(null);
    setLastDroppedCell(null);
    setTurnTimer(TURN_TIME_LIMIT);
    setStatusMessage('New match initialized! RED drops first.');

    if (gameMode !== 'VS_AI' && sessionId) {
      connectdropSocket.requestRematch(sessionId, playerId);
    }

    if (isAiOpponent && myColor === 'YELLOW') {
      scheduleAiMove(empty, 'RED');
    }
  }, [gameMode, sessionId, playerId, isAiOpponent, myColor, scheduleAiMove]);

  // WebSocket Message Dispatcher
  const handleSocketMessage = useCallback(
    (payload) => {
      if (!payload) return;

      // Player joined / match active
      if (payload.type === 'PLAYER_JOINED' || payload.status === 'ACTIVE') {
        if (payload.playerYellowName) setPlayerYellowName(payload.playerYellowName);
        if (payload.playerRedName) setPlayerRedName(payload.playerRedName);
        setView('PLAYING');
        setTurnTimer(TURN_TIME_LIMIT);
        setStatusMessage('Challenger connected! RED begins the duel.');
        showToast('Challenger joined the arena!', 'success');
      } else if (payload.type === 'DISC_DROPPED' || payload.column !== undefined) {
        // Opponent drop
        const { column, color, playerId: eventPlayerId } = payload;
        if (eventPlayerId !== playerId && column !== undefined) {
          executeDrop(column, color || (myColorRef.current === 'RED' ? 'YELLOW' : 'RED'));
        }
      } else if (payload.type === 'REMATCH_REQUESTED' || payload.type === 'RESTART_GAME') {
        restartGame();
        showToast('Rematch accepted! New round started.', 'info');
      }
    },
    [playerId, executeDrop, restartGame, showToast]
  );

  // Setup Solo AI Match
  const startSoloAi = () => {
    setGameMode('VS_AI');
    setIsAiOpponent(true);
    setMyColor('RED');
    setPlayerRedName(playerName || 'You');
    setPlayerYellowName('Cyber AI');
    setGrid(createEmptyGrid());
    setCurrentTurn('RED');
    setIsGameOver(false);
    setWinner(null);
    setWinningCells(null);
    setLastDroppedCell(null);
    setTurnTimer(TURN_TIME_LIMIT);
    setStatusMessage('Solo AI duel active. You are RED (drops first). Good luck!');
    setView('PLAYING');
  };

  // Setup Quick Match
  const startQuickMatch = async () => {
    setLoading(true);
    setStatusMessage('Searching for active Cyber duelists in the matchmaking pool...');
    try {
      const match = await queueQuickMatch({ playerId, playerName });
      setGameMode('QUICK_MATCH');
      setIsAiOpponent(false);
      setRoomCode(match.roomCode || 'CND-QUICK');
      setSessionId(match.sessionId);
      setMyColor(match.assignedColor || 'RED');
      setPlayerRedName(match.playerRedName || 'Player Red');
      setPlayerYellowName(match.playerYellowName || 'Player Yellow');
      setGrid(createEmptyGrid());
      setCurrentTurn('RED');
      setIsGameOver(false);
      setWinner(null);
      setWinningCells(null);
      setLastDroppedCell(null);
      setTurnTimer(TURN_TIME_LIMIT);

      // Connect WebSocket
      connectdropSocket.connect(
        match.sessionId,
        handleSocketMessage,
        (err) => console.warn('[ConnectDropWS] Connection note:', err.message)
      );

      setView('PLAYING');
      setStatusMessage('Matched with online player! RED drops first.');
      showToast('Quick match opponent found!', 'success');
    } catch (err) {
      console.warn('Quick Match failed:', err);
      showToast('Could not reach quick match server. Starting smart AI duel instead.', 'warning');
      startSoloAi();
    } finally {
      setLoading(false);
    }
  };

  // Create Private Room
  const createPrivateRoom = async () => {
    setLoading(true);
    try {
      const room = await createConnectDropRoom({ playerId, playerName });
      setGameMode('PRIVATE');
      setIsAiOpponent(false);
      setRoomCode(room.roomCode);
      setSessionId(room.sessionId);
      setMyColor('RED');
      setPlayerRedName(playerName || 'Host Player');
      setPlayerYellowName('Waiting for opponent...');
      setGrid(createEmptyGrid());
      setCurrentTurn('RED');
      setIsGameOver(false);
      setWinner(null);
      setWinningCells(null);
      setLastDroppedCell(null);

      // Connect WebSocket and wait in waiting room
      connectdropSocket.connect(
        room.sessionId,
        handleSocketMessage,
        (err) => console.warn('[ConnectDropWS] Host connection note:', err.message)
      );

      setView('WAITING_ROOM');
      showToast(`Private arena created: ${room.roomCode}`, 'success');
    } catch (err) {
      console.warn('Create room error:', err);
      showToast('Failed to create private room.', 'warning');
    } finally {
      setLoading(false);
    }
  };

  // Join Private Room
  const joinPrivateRoom = useCallback(async (codeToJoin) => {
    const code = (codeToJoin || joinCodeInput).trim().toUpperCase();
    if (!code) {
      showToast('Please enter a valid room code (e.g. CND-A1B2)', 'warning');
      return;
    }
    setLoading(true);
    try {
      const room = await joinConnectDropRoom({ roomCode: code, playerId, playerName });
      setGameMode('PRIVATE');
      setIsAiOpponent(false);
      setRoomCode(room.roomCode || code);
      setSessionId(room.sessionId);
      setMyColor('YELLOW');
      setPlayerRedName(room.playerRedName || 'Host Challenger');
      setPlayerYellowName(playerName || 'Guest Player');
      setGrid(createEmptyGrid());
      setCurrentTurn('RED');
      setIsGameOver(false);
      setWinner(null);
      setWinningCells(null);
      setLastDroppedCell(null);
      setTurnTimer(TURN_TIME_LIMIT);

      // Connect WebSocket
      connectdropSocket.connect(
        room.sessionId,
        handleSocketMessage,
        (err) => console.warn('[ConnectDropWS] Guest connection note:', err.message)
      );

      setView('PLAYING');
      setStatusMessage(`Joined Arena ${code}! Match is live. RED drops first.`);
      showToast(`Joined room ${code}!`, 'success');
    } catch (err) {
      console.warn('Join room error:', err);
      showToast('Failed to join room. Verify code and try again.', 'warning');
    } finally {
      setLoading(false);
    }
  }, [joinCodeInput, playerId, playerName, handleSocketMessage, showToast]);

  // Auto-join from URL parameter
  useEffect(() => {
    const urlRoom = searchParams.get('room');
    if (urlRoom && view === 'LOBBY') {
      getConnectDropRoomStatus(urlRoom)
        .then(() => {
          joinPrivateRoom(urlRoom);
        })
        .catch(() => {});
    }
  }, [searchParams, view, joinPrivateRoom]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      connectdropSocket.disconnect();
    };
  }, []);

  // Copy shareable link
  const copyShareLink = () => {
    const link = `${window.location.origin}/games/connectdrop?room=${roomCode}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(link);
      setCopySuccess(true);
      showToast('Shareable invite link copied to clipboard!', 'success');
      setTimeout(() => setCopySuccess(false), 2500);
    }
  };

  // Check if cell is in winning line
  const isWinningCell = (r, c) => {
    if (!winningCells) return false;
    return winningCells.some(([wr, wc]) => wr === r && wc === c);
  };

  // Compute SVG laser line coordinates between first and last winning cells
  const getWinningLaserCoords = () => {
    if (!winningCells || winningCells.length < 4) return null;
    const [r0, c0] = winningCells[0];
    const [r3, c3] = winningCells[3];
    // Percent coordinates relative to 7x6 grid
    const x1 = ((c0 + 0.5) / CONNECT_DROP_COLS) * 100;
    const y1 = ((r0 + 0.5) / CONNECT_DROP_ROWS) * 100;
    const x2 = ((c3 + 0.5) / CONNECT_DROP_COLS) * 100;
    const y2 = ((r3 + 0.5) / CONNECT_DROP_ROWS) * 100;
    return { x1, y1, x2, y2 };
  };

  const laserCoords = getWinningLaserCoords();

  return (
    <div className="connectdrop-container">
      {/* Toast Notification */}
      {toast && (
        <div className={`connectdrop-toast toast-${toast.type}`}>
          <span className="toast-icon">
            {toast.type === 'success' ? '⚡' : toast.type === 'warning' ? '⚠️' : 'ℹ️'}
          </span>
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Breadcrumb Navigation */}
      <nav className="connectdrop-breadcrumb">
        <Link to="/">Home</Link>
        <span className="breadcrumb-separator">/</span>
        <Link to="/games">Games</Link>
        <span className="breadcrumb-separator">/</span>
        <span className="breadcrumb-active">Connect Drop</span>
      </nav>

      {/* ========================================================================= */}
      {/* VIEW: LOBBY                                                               */}
      {/* ========================================================================= */}
      {view === 'LOBBY' && (
        <div className="connectdrop-lobby-view">
          {/* Hero Banner */}
          <header className="connectdrop-hero">
            <div className="hero-badge">
              <span className="badge-pulse-dot" />
              <span>PvP Strategy Duel • 7×6 Matrix</span>
            </div>
            <h1 className="hero-title">Connect Drop</h1>
            <p className="hero-tagline">
              Real-time 2-player gravity-drop duel. Align 4 neon discs horizontally, vertically,
              or diagonally while predicting and blocking your opponent’s tactical trajectory.
            </p>

            <div className="hero-stats-row">
              <div className="hero-stat">
                <span className="stat-label">Grid Dimensions</span>
                <span className="stat-value">7 Cols × 6 Rows</span>
              </div>
              <div className="hero-stat">
                <span className="stat-label">Turn Clock</span>
                <span className="stat-value">20 Seconds</span>
              </div>
              <div className="hero-stat">
                <span className="stat-label">Match Mode</span>
                <span className="stat-value">1v1 PvP / AI</span>
              </div>
            </div>
          </header>

          {/* Game Modes */}
          <div className="modes-grid">
            {/* Quick Match */}
            <div className="mode-card primary-card">
              <div className="mode-card-badge">INSTANT MATCH</div>
              <div className="mode-card-icon">⚡</div>
              <h3>Quick Match</h3>
              <p>
                Hop straight into the PvP matchmaking pool and challenge active online strategists
                in lightning-fast rounds.
              </p>
              <button
                className="btn-cyber btn-primary"
                onClick={startQuickMatch}
                disabled={loading}
              >
                {loading ? 'Connecting...' : '⚡ Find Quick Match'}
              </button>
            </div>

            {/* Play With Friends */}
            <div className="mode-card highlight-card">
              <div className="mode-card-badge">PRIVATE ARENA</div>
              <div className="mode-card-icon">🔗</div>
              <h3>Play with Friends</h3>
              <p>
                Generate a private duel code, send a one-click invite link to your colleague, and
                settle office rivalries.
              </p>
              <button
                className="btn-cyber btn-secondary"
                onClick={createPrivateRoom}
                disabled={loading}
              >
                {loading ? 'Creating...' : '🔗 Create Private Room'}
              </button>
            </div>

            {/* Solo vs AI */}
            <div className="mode-card ai-card">
              <div className="mode-card-badge">OFFLINE READY</div>
              <div className="mode-card-icon">🤖</div>
              <h3>Solo vs AI</h3>
              <p>
                Sharpen your tactical vision against an intelligent AI opponent that calculates
                blocks, fork setups, and lethal alignments.
              </p>
              <button
                className="btn-cyber btn-accent"
                onClick={startSoloAi}
                disabled={loading}
              >
                🤖 Solo vs AI
              </button>
            </div>
          </div>

          {/* Join Private Room Panel */}
          <section className="join-panel">
            <div className="join-panel-header">
              <h3>Have an Arena Invite Code?</h3>
              <p>Enter the 8-character duel code sent by your challenger:</p>
            </div>
            <div className="join-input-group">
              <input
                type="text"
                className="cyber-input"
                placeholder="e.g. CND-7K9A"
                maxLength={10}
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') joinPrivateRoom();
                }}
              />
              <button
                className="btn-cyber btn-primary join-btn"
                onClick={() => joinPrivateRoom()}
                disabled={loading || !joinCodeInput.trim()}
              >
                ⚔️ Join Arena
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW: WAITING ROOM                                                        */}
      {/* ========================================================================= */}
      {view === 'WAITING_ROOM' && (
        <div className="waiting-room-card">
          <div className="waiting-header">
            <span className="radar-spinner" />
            <h2>Private Arena Created</h2>
            <p className="waiting-subtitle">
              Share the arena room code or invite link with your challenger to begin.
            </p>
          </div>

          <div className="room-code-display">
            <span className="code-label">ARENA ROOM CODE</span>
            <span className="code-value">{roomCode}</span>
          </div>

          <div className="share-link-box">
            <input
              type="text"
              readOnly
              value={`${window.location.origin}/games/connectdrop?room=${roomCode}`}
              className="share-link-input"
            />
            <button className="btn-cyber btn-copy" onClick={copyShareLink}>
              {copySuccess ? '✅ Copied!' : '📋 Copy Link'}
            </button>
          </div>

          <div className="waiting-pulse-status">
            <span className="pulse-indicator" />
            <span>Waiting for Challenger to join the grid...</span>
          </div>

          <div className="waiting-actions">
            <button
              className="btn-cyber btn-outline"
              onClick={() => {
                connectdropSocket.disconnect();
                setView('LOBBY');
              }}
            >
              ⬅️ Cancel & Return to Lobby
            </button>
            <button
              className="btn-cyber btn-accent"
              onClick={() => {
                // Allow host to start match in Solo AI mode if challenger is taking too long
                startSoloAi();
                showToast('Switched to Solo AI match', 'info');
              }}
            >
              🤖 Play Solo vs AI While Waiting
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW: PLAYING (7x6 ARENA)                                                 */}
      {/* ========================================================================= */}
      {view === 'PLAYING' && (
        <div className="connectdrop-arena">
          {/* Top Scorebar & Turn Status */}
          <div className="arena-scorebar">
            {/* Player Red Profile */}
            <div
              className={`player-badge red-player ${
                currentTurn === 'RED' && !isGameOver ? 'active-turn' : ''
              }`}
            >
              <div className="player-disc-indicator red-glow">🔴</div>
              <div className="player-meta">
                <span className="player-title">
                  {playerRedName} {myColor === 'RED' ? '(You)' : ''}
                </span>
                <span className="player-wins">Score: {scores.RED} wins</span>
              </div>
              {currentTurn === 'RED' && !isGameOver && (
                <span className="turn-pill red-pill">TURN</span>
              )}
            </div>

            {/* Match VS Clock Center */}
            <div className="match-center-info">
              <div className="match-vs-banner">
                <span className="vs-text">VS</span>
                <button
                  className="sound-toggle-btn"
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  title={soundEnabled ? 'Mute SFX' : 'Enable SFX'}
                >
                  {soundEnabled ? '🔊' : '🔇'}
                </button>
              </div>

              {/* Turn Countdown Timer */}
              {!isGameOver && (
                <div className="turn-timer-container">
                  <div className="timer-label-row">
                    <span className="timer-text">
                      {currentTurn === myColor ? '⚡ YOUR TURN' : '⏳ OPPONENT TURN'}
                    </span>
                    <span
                      className={`timer-seconds ${turnTimer <= 5 ? 'timer-critical' : ''}`}
                    >
                      {turnTimer}s
                    </span>
                  </div>
                  <div className="timer-progress-track">
                    <div
                      className={`timer-progress-fill ${
                        currentTurn === 'RED' ? 'fill-red' : 'fill-yellow'
                      } ${turnTimer <= 5 ? 'fill-critical' : ''}`}
                      style={{ width: `${(turnTimer / TURN_TIME_LIMIT) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Player Yellow Profile */}
            <div
              className={`player-badge yellow-player ${
                currentTurn === 'YELLOW' && !isGameOver ? 'active-turn' : ''
              }`}
            >
              <div className="player-disc-indicator yellow-glow">🟡</div>
              <div className="player-meta">
                <span className="player-title">
                  {playerYellowName} {myColor === 'YELLOW' ? '(You)' : ''}
                </span>
                <span className="player-wins">Score: {scores.YELLOW} wins</span>
              </div>
              {currentTurn === 'YELLOW' && !isGameOver && (
                <span className="turn-pill yellow-pill">TURN</span>
              )}
            </div>
          </div>

          {/* Turn Banner */}
          <div
            className={`arena-turn-banner ${
              currentTurn === myColor ? 'banner-mine' : 'banner-theirs'
            }`}
          >
            <span className="turn-banner-dot" />
            <span className="turn-banner-text">
              {statusMessage ||
                (currentTurn === myColor
                  ? 'Your turn! Click a column to drop your disc.'
                  : `Waiting for ${
                      currentTurn === 'RED' ? playerRedName : playerYellowName
                    } to drop...`)}
            </span>
          </div>

          {/* Arena Matrix Wrapper */}
          <div className="board-outer-shell">
            {/* Column Hover Indicator Drop Bar */}
            <div className="column-selector-bar">
              {Array.from({ length: CONNECT_DROP_COLS }).map((_, c) => {
                const isHovered = hoveredCol === c;
                const dropRow = findDropRow(grid, c);
                const isFull = dropRow === -1;
                const canDrop = !isGameOver && currentTurn === myColor && !isFull;

                return (
                  <button
                    key={`col-select-${c}`}
                    className={`col-drop-zone ${isHovered && canDrop ? 'zone-active' : ''} ${
                      isFull ? 'zone-full' : ''
                    }`}
                    onMouseEnter={() => setHoveredCol(c)}
                    onMouseLeave={() => setHoveredCol(null)}
                    onClick={() => handleColumnClick(c)}
                    disabled={isGameOver || isFull}
                    aria-label={`Drop disc into column ${c + 1}`}
                  >
                    {isHovered && canDrop && (
                      <div
                        className={`floating-drop-disc ${
                          myColor === 'RED' ? 'disc-red-ghost' : 'disc-yellow-ghost'
                        }`}
                      >
                        ⬇
                      </div>
                    )}
                    {isFull && <span className="full-badge">FULL</span>}
                  </button>
                );
              })}
            </div>

            {/* 7x6 Connect Drop Board Frame */}
            <div className="connectdrop-grid-frame">
              {/* Optional SVG connecting laser line across winning cells */}
              {laserCoords && (
                <svg className="winning-laser-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <line
                    x1={`${laserCoords.x1}%`}
                    y1={`${laserCoords.y1}%`}
                    x2={`${laserCoords.x2}%`}
                    y2={`${laserCoords.y2}%`}
                    className="winning-laser-line"
                  />
                </svg>
              )}

              {/* Grid Cells */}
              {grid.map((rowArr, r) => (
                <div key={`row-${r}`} className="grid-row">
                  {rowArr.map((cellValue, c) => {
                    const isWinning = isWinningCell(r, c);
                    const isLastDropped =
                      lastDroppedCell &&
                      lastDroppedCell[0] === r &&
                      lastDroppedCell[1] === c;
                    const isColumnTarget =
                      hoveredCol === c &&
                      cellValue === null &&
                      findDropRow(grid, c) === r &&
                      currentTurn === myColor &&
                      !isGameOver;

                    return (
                      <div
                        key={`cell-${r}-${c}`}
                        className={`board-cell ${
                          isWinning ? 'cell-winning' : ''
                        } ${isColumnTarget ? 'cell-ghost-target' : ''}`}
                        onClick={() => handleColumnClick(c)}
                        onMouseEnter={() => setHoveredCol(c)}
                      >
                        {/* Cell Socket Hole */}
                        <div className="cell-hole">
                          {/* Placed Disc */}
                          {cellValue && (
                            <div
                              className={`placed-disc ${
                                cellValue === 'RED' ? 'disc-red' : 'disc-yellow'
                              } ${isWinning ? 'winning-pulse-disc' : ''} ${
                                isLastDropped ? 'animate-drop-bounce' : ''
                              }`}
                              style={{
                                '--drop-rows': r + 1,
                              }}
                            >
                              <div className="disc-inner-bevel" />
                              <div className="disc-core-shine" />
                            </div>
                          )}

                          {/* Hover Ghost Disc Preview */}
                          {isColumnTarget && (
                            <div
                              className={`ghost-preview-disc ${
                                myColor === 'RED'
                                  ? 'ghost-red-disc'
                                  : 'ghost-yellow-disc'
                              }`}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Arena Footer Control Actions */}
          <div className="arena-controls">
            <button
              className="btn-cyber btn-outline"
              onClick={() => {
                connectdropSocket.disconnect();
                setView('LOBBY');
              }}
            >
              ⬅️ Abandon Arena
            </button>
            <button
              className="btn-cyber btn-secondary"
              onClick={restartGame}
              disabled={loading}
            >
              🔄 Reset Board
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* GAME OVER / VICTORY MODAL                                                 */}
      {/* ========================================================================= */}
      {isGameOver && (
        <div className="modal-backdrop">
          <div className="gameover-modal">
            <div className="modal-header">
              <span className="trophy-badge">
                {winner === myColor ? '🏆' : winner === 'DRAW' ? '🤝' : '💀'}
              </span>
              <h2
                className={`modal-title ${
                  winner === myColor
                    ? 'victory-title'
                    : winner === 'DRAW'
                    ? 'draw-title'
                    : 'defeat-title'
                }`}
              >
                {winner === myColor
                  ? 'VICTORY!'
                  : winner === 'DRAW'
                  ? 'DRAW GAME!'
                  : 'ROUND DEFEAT'}
              </h2>
              <p className="modal-subtitle">
                {winner === myColor
                  ? 'You connected 4 neon discs and dominated the arena!'
                  : winner === 'DRAW'
                  ? 'All 42 matrix cells filled with no decisive alignment.'
                  : `${
                      winner === 'RED' ? playerRedName : playerYellowName
                    } locked in 4-in-a-row!`}
              </p>
            </div>

            <div className="modal-scoreboard">
              <div className="score-box red-score">
                <span className="score-player">{playerRedName}</span>
                <span className="score-num">{scores.RED}</span>
              </div>
              <div className="score-divider">:</div>
              <div className="score-box yellow-score">
                <span className="score-player">{playerYellowName}</span>
                <span className="score-num">{scores.YELLOW}</span>
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="btn-cyber btn-primary"
                onClick={restartGame}
                autoFocus
              >
                🔄 Play Again / Rematch
              </button>
              <button
                className="btn-cyber btn-outline"
                onClick={() => {
                  connectdropSocket.disconnect();
                  setView('LOBBY');
                }}
              >
                🏠 Return to Lobby
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConnectDropLobby;

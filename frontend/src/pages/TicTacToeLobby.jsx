import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';
import {
  tictactoeApi,
  checkWinner,
  computeBestAIMove,
} from '../services/tictactoeApi';
import { tictactoeSocket } from '../services/tictactoeSocket';
import './TicTacToeLobby.css';

const INITIAL_BOARD = Array(9).fill('');

const TicTacToeLobby = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  // Active view: 'LOBBY' | 'WAITING_ROOM' | 'PLAYING'
  const [view, setView] = useState('LOBBY');
  const [gameMode, setGameMode] = useState('VS_AI'); // 'VS_AI' | 'QUICK_MATCH' | 'PRIVATE'

  // Room & Player state
  const [roomCode, setRoomCode] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState(() => {
    return (searchParams.get('room') || '').trim().toUpperCase();
  });
  const [mySymbol, setMySymbol] = useState('X');
  const [playerXName, setPlayerXName] = useState('Player X');
  const [playerOName, setPlayerOName] = useState('Player O');
  const [isAiOpponent, setIsAiOpponent] = useState(false);

  // Gameplay state
  const [board, setBoard] = useState(INITIAL_BOARD);
  const [currentTurn, setCurrentTurn] = useState('X');
  const [turnTimer, setTurnTimer] = useState(30);
  const [winner, setWinner] = useState(null); // 'X' | 'O' | 'DRAW' | null
  const [winningPattern, setWinningPattern] = useState(null); // e.g. [0, 1, 2]
  const [isGameOver, setIsGameOver] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Hover ghost preview
  const [hoveredCell, setHoveredCell] = useState(null);

  // State refs for async callbacks
  const boardRef = useRef(board);
  const currentTurnRef = useRef(currentTurn);
  const isGameOverRef = useRef(isGameOver);
  const mySymbolRef = useRef(mySymbol);

  useEffect(() => {
    boardRef.current = board;
    currentTurnRef.current = currentTurn;
    isGameOverRef.current = isGameOver;
    mySymbolRef.current = mySymbol;
  }, [board, currentTurn, isGameOver, mySymbol]);

  const playerId = user?.userId || 'GUEST_LOCAL';
  const playerName = user?.displayName || 'Player';

  // Handle Confetti Celebration
  const triggerCelebration = useCallback(() => {
    try {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#00f2fe', '#4facfe', '#00ffaa', '#e94560', '#ff007f'],
      });
    } catch (e) {
      console.warn('Confetti error:', e);
    }
  }, []);

  // Handle Game Over
  const handleGameOver = useCallback(
    (winResult) => {
      setIsGameOver(true);
      setWinner(winResult.winner);
      setWinningPattern(winResult.winningPattern);

      if (winResult.winner === mySymbolRef.current) {
        triggerCelebration();
        setStatusMessage('🎉 VICTORY! You won the match!');
      } else if (winResult.winner === 'DRAW') {
        setStatusMessage("🤝 STALEMATE! It's a draw!");
      } else {
        setStatusMessage('💀 DEFEAT! Opponent won the match.');
      }
    },
    [triggerCelebration]
  );

  // AI Move Scheduler
  const scheduleAiMove = useCallback((currentBoard, aiSym) => {
    setTimeout(() => {
      if (isGameOverRef.current) return;
      const bestMove = computeBestAIMove(currentBoard, aiSym);
      if (bestMove !== null && bestMove !== undefined) {
        const nextBoard = [...currentBoard];
        nextBoard[bestMove] = aiSym;
        setBoard(nextBoard);

        const outcome = checkWinner(nextBoard);
        if (outcome) {
          handleGameOver(outcome);
        } else {
          setCurrentTurn(aiSym === 'X' ? 'O' : 'X');
          setTurnTimer(30);
        }
      }
    }, 600);
  }, [handleGameOver]);

  // Restart / Rematch
  const restartGame = useCallback(() => {
    setBoard(INITIAL_BOARD);
    setCurrentTurn('X');
    setIsGameOver(false);
    setWinner(null);
    setWinningPattern(null);
    setTurnTimer(30);
    setStatusMessage('New round started! Player X starts.');

    if (gameMode !== 'VS_AI' && sessionId) {
      tictactoeSocket.requestRematch(sessionId, playerId, mySymbol);
    }

    if (isAiOpponent && mySymbol === 'O') {
      scheduleAiMove(INITIAL_BOARD, 'X');
    }
  }, [gameMode, sessionId, playerId, mySymbol, isAiOpponent, scheduleAiMove]);

  // WebSocket incoming message handler
  const handleSocketMessage = useCallback(
    (payload) => {
      if (!payload) return;

      if (payload.type === 'PLAYER_JOINED' || payload.status === 'ACTIVE') {
        if (payload.playerO) setPlayerOName(payload.playerO);
        if (payload.playerX) setPlayerXName(payload.playerX);
        setView('PLAYING');
        setTurnTimer(30);
        setStatusMessage('Opponent connected! Game begins.');
      } else if (payload.type === 'MOVE_MADE' || payload.position !== undefined) {
        const { position, symbol, board: serverBoard } = payload;
        if (serverBoard && Array.isArray(serverBoard)) {
          setBoard(serverBoard);
          const outcome = checkWinner(serverBoard);
          if (outcome) {
            handleGameOver(outcome);
            return;
          }
        } else if (position !== undefined && symbol) {
          setBoard((prev) => {
            const next = [...prev];
            next[position] = symbol;
            const outcome = checkWinner(next);
            if (outcome) {
              handleGameOver(outcome);
            }
            return next;
          });
        }
        setTurnTimer(30);
        if (payload.nextTurn) {
          setCurrentTurn(payload.nextTurn);
        } else {
          setCurrentTurn((prev) => (prev === 'X' ? 'O' : 'X'));
        }
      } else if (payload.type === 'GAME_OVER') {
        handleGameOver({
          winner: payload.winner,
          winningPattern: payload.winningPattern,
        });
      } else if (payload.type === 'REMATCH_ACCEPTED' || payload.type === 'REMATCH_START') {
        restartGame();
      }
    },
    [handleGameOver, restartGame]
  );

  // Turn Countdown Timer (30s)
  useEffect(() => {
    if (view !== 'PLAYING' || isGameOver) {
      return;
    }

    const interval = setInterval(() => {
      setTurnTimer((prev) => {
        if (prev <= 1) {
          setCurrentTurn((curr) => (curr === 'X' ? 'O' : 'X'));
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [view, isGameOver, currentTurn]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      tictactoeSocket.disconnect();
    };
  }, []);

  // Start Quick Match
  const startQuickMatch = async () => {
    setLoading(true);
    setStatusMessage('Searching for online challenger...');
    setGameMode('QUICK_MATCH');
    try {
      const res = await tictactoeApi.quickMatch(playerId, playerName);
      setSessionId(res.sessionId);
      setRoomCode(res.roomCode);
      const symbol = res.assignedSymbol || 'X';
      setMySymbol(symbol);
      setPlayerXName(res.playerXName || (symbol === 'X' ? playerName : 'Opponent X'));
      setPlayerOName(res.playerOName || (symbol === 'O' ? playerName : 'Opponent O'));

      tictactoeSocket.connect({
        sessionId: res.sessionId,
        onMessage: handleSocketMessage,
        onError: () => {
          setIsAiOpponent(true);
        },
      });

      if (res.isOfflineFallback) {
        setIsAiOpponent(true);
      } else {
        setIsAiOpponent(false);
      }

      setBoard(INITIAL_BOARD);
      setCurrentTurn('X');
      setTurnTimer(30);
      setIsGameOver(false);
      setWinner(null);
      setWinningPattern(null);
      setView('PLAYING');
      setStatusMessage(symbol === 'X' ? 'Match started! Your move (X).' : 'Match started! Opponent moves first (X).');

      if (res.isOfflineFallback && symbol === 'O') {
        scheduleAiMove(INITIAL_BOARD, 'X');
      }
    } catch (err) {
      console.error('Quick match error:', err);
      setStatusMessage('Failed to start quick match. Try offline mode.');
    } finally {
      setLoading(false);
    }
  };

  // Create Private Room
  const createPrivateRoom = async () => {
    setLoading(true);
    setStatusMessage('Creating private room...');
    setGameMode('PRIVATE');
    try {
      const res = await tictactoeApi.createRoom(playerId, playerName);
      setRoomCode(res.roomCode);
      setSessionId(res.sessionId);
      setMySymbol('X');
      setPlayerXName(playerName);
      setPlayerOName('Waiting for friend...');
      setIsAiOpponent(false);
      setView('WAITING_ROOM');

      tictactoeSocket.connect({
        sessionId: res.sessionId,
        onMessage: handleSocketMessage,
        onError: () => {},
      });
    } catch (err) {
      console.error('Create room error:', err);
      setStatusMessage('Error creating room. Try practice mode.');
    } finally {
      setLoading(false);
    }
  };

  // Join Private Room
  const joinPrivateRoom = async (codeToJoin) => {
    const code = (codeToJoin || joinCodeInput).trim().toUpperCase();
    if (!code) {
      setStatusMessage('Please enter a valid room code.');
      return;
    }
    setLoading(true);
    setStatusMessage(`Connecting to room ${code}...`);
    setGameMode('PRIVATE');
    try {
      const res = await tictactoeApi.joinRoom(code, playerId, playerName);
      setRoomCode(res.roomCode || code);
      setSessionId(res.sessionId);
      setMySymbol('O');
      setPlayerXName(res.playerXName || 'Room Host');
      setPlayerOName(playerName);
      setIsAiOpponent(false);

      tictactoeSocket.connect({
        sessionId: res.sessionId,
        onMessage: handleSocketMessage,
        onError: () => {},
      });

      setBoard(INITIAL_BOARD);
      setCurrentTurn(res.currentTurn || 'X');
      setTurnTimer(30);
      setIsGameOver(false);
      setWinner(null);
      setWinningPattern(null);
      setView('PLAYING');
      setStatusMessage(`Joined room ${code}! Waiting for host to play.`);
    } catch (err) {
      console.error('Join room error:', err);
      setStatusMessage('Could not join room. Check the code and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Start Practice vs AI
  const startVsAi = () => {
    setGameMode('VS_AI');
    setRoomCode('LOCAL_AI');
    setSessionId('SESSION_AI');
    setMySymbol('X');
    setPlayerXName(`${playerName} (You)`);
    setPlayerOName('Cyber AI Bot');
    setIsAiOpponent(true);
    setBoard(INITIAL_BOARD);
    setCurrentTurn('X');
    setTurnTimer(30);
    setIsGameOver(false);
    setWinner(null);
    setWinningPattern(null);
    setView('PLAYING');
    setStatusMessage('Practice vs Cyber AI started. You are X!');
  };

  // Cell Click Handler
  const handleCellClick = (index) => {
    if (view !== 'PLAYING' || isGameOver) return;
    if (board[index] !== '') return;
    if (currentTurn !== mySymbol) return;

    const newBoard = [...board];
    newBoard[index] = mySymbol;
    setBoard(newBoard);
    setTurnTimer(30);

    if (gameMode !== 'VS_AI' && sessionId) {
      tictactoeSocket.sendMove(sessionId, playerId, index, mySymbol);
    }

    const outcome = checkWinner(newBoard);
    if (outcome) {
      handleGameOver(outcome);
      return;
    }

    const nextTurn = mySymbol === 'X' ? 'O' : 'X';
    setCurrentTurn(nextTurn);

    if (isAiOpponent) {
      scheduleAiMove(newBoard, nextTurn);
    }
  };

  // Return to Lobby
  const returnToLobby = () => {
    tictactoeSocket.disconnect();
    setView('LOBBY');
    setBoard(INITIAL_BOARD);
    setIsGameOver(false);
    setWinner(null);
    setWinningPattern(null);
    setRoomCode('');
    setSessionId('');
    setStatusMessage('');
  };

  // Copy shareable URL
  const copyShareableLink = () => {
    const fullUrl = `${window.location.origin}/games/tictactoe?room=${roomCode}`;
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2500);
    });
  };

  // Copy raw room code
  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2500);
    });
  };

  // Determine strike-through class for winning cells
  const getStrikeThroughClass = () => {
    if (!winningPattern) return '';
    const patternStr = winningPattern.join(',');
    if (patternStr === '0,1,2') return 'strike-row-0';
    if (patternStr === '3,4,5') return 'strike-row-1';
    if (patternStr === '6,7,8') return 'strike-row-2';
    if (patternStr === '0,3,6') return 'strike-col-0';
    if (patternStr === '1,4,7') return 'strike-col-1';
    if (patternStr === '2,5,8') return 'strike-col-2';
    if (patternStr === '0,4,8') return 'strike-diag-main';
    if (patternStr === '2,4,6') return 'strike-diag-anti';
    return '';
  };

  const isMyTurn = currentTurn === mySymbol && !isGameOver;

  return (
    <div className="tictactoe-lobby-container">
      {/* Navigation Breadcrumb */}
      <nav className="lobby-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        <Link to="/games">Games</Link>
        <span>/</span>
        <span className="breadcrumb-current">Tic-Tac-Toe Arena</span>
      </nav>

      {/* LOBBY VIEW */}
      {view === 'LOBBY' && (
        <div className="lobby-hero">
          <div className="lobby-hero-badge">
            <span className="badge-pulse-dot"></span> Real-Time 1v1 PvP
          </div>

          <h1 className="lobby-title">Tic-Tac-Toe Arena</h1>
          <p className="lobby-subtitle">
            Stateless microservice multiplayer with instant matchmaking and private room invites.
          </p>

          {/* Action Cards Grid */}
          <div className="modes-grid">
            {/* Quick Match Card */}
            <div className="mode-card primary-card">
              <div className="mode-card-icon">⚡</div>
              <h3>Quick Match</h3>
              <p>Instantly match with an online challenger in random matchmaking queue.</p>
              <button
                type="button"
                className="mode-btn btn-neon-cyan"
                onClick={startQuickMatch}
                disabled={loading}
              >
                {loading ? 'Finding Opponent...' : '⚡ Find Random Opponent'}
              </button>
            </div>

            {/* Create Private Room Card */}
            <div className="mode-card highlight-card">
              <div className="mode-card-icon">🔗</div>
              <h3>Create Private Room</h3>
              <p>Generate a custom 6-character room code and shareable link to play with a coworker or friend.</p>
              <button
                type="button"
                className="mode-btn btn-neon-magenta"
                onClick={createPrivateRoom}
                disabled={loading}
              >
                🔗 Create Private Room
              </button>
            </div>

            {/* Join Private Room Card */}
            <div className="mode-card">
              <div className="mode-card-icon">🔑</div>
              <h3>Join Private Room</h3>
              <p>Got an invite code from a friend? Enter the 6-character room code below.</p>
              <div className="join-form">
                <input
                  type="text"
                  placeholder="e.g. TTT-7X9B"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  maxLength={10}
                  className="join-input"
                />
                <button
                  type="button"
                  className="mode-btn btn-outline"
                  onClick={() => joinPrivateRoom()}
                  disabled={loading || !joinCodeInput.trim()}
                >
                  Join Match
                </button>
              </div>
            </div>

            {/* Practice vs AI Card */}
            <div className="mode-card">
              <div className="mode-card-icon">🤖</div>
              <h3>Practice vs AI</h3>
              <p>Warm up offline against smart heuristic CyberBot with instant response.</p>
              <button
                type="button"
                className="mode-btn btn-neon-green"
                onClick={startVsAi}
              >
                🤖 Practice vs AI (Offline)
              </button>
            </div>
          </div>

          {statusMessage && (
            <div className="status-toast" role="status">
              {statusMessage}
            </div>
          )}
        </div>
      )}

      {/* WAITING FOR OPPONENT VIEW (Private Room Modal / Screen) */}
      {view === 'WAITING_ROOM' && (
        <div className="lobby-hero waiting-hero">
          <div className="waiting-container">
            <span className="lobby-status-tag">Room Created</span>
            <h2 className="waiting-title">Invite Your Challenger</h2>
            <p className="waiting-desc">
              Share the room code or copy the direct link to start the match immediately once they connect.
            </p>

            <div className="room-code-display">
              <span className="room-code-label">ROOM CODE</span>
              <span className="room-code-value">{roomCode}</span>
            </div>

            <div className="shareable-link-box">
              <input
                type="text"
                readOnly
                value={`${window.location.origin}/games/tictactoe?room=${roomCode}`}
                className="shareable-link-input"
              />
              <button
                type="button"
                className="copy-btn"
                onClick={copyShareableLink}
              >
                {copySuccess ? '✅ Copied!' : '📋 Copy Link'}
              </button>
              <button
                type="button"
                className="copy-btn secondary-btn"
                onClick={copyRoomCode}
              >
                Copy Code
              </button>
            </div>

            {/* Pulsing Waiting Indicator */}
            <div className="pulsing-indicator-box">
              <div className="pulse-ring"></div>
              <div className="pulse-dot"></div>
              <span className="pulsing-text">Waiting for opponent to connect...</span>
            </div>

            {/* Offline simulation options for testing */}
            <div className="waiting-actions">
              <button
                type="button"
                className="mode-btn btn-neon-green"
                onClick={() => {
                  setPlayerOName('Bot Challenger');
                  setIsAiOpponent(true);
                  setView('PLAYING');
                  setStatusMessage('Match started vs Bot Challenger!');
                }}
              >
                🤖 Test Match Immediately (Start vs Bot)
              </button>
              <button
                type="button"
                className="mode-btn btn-outline"
                onClick={returnToLobby}
              >
                🚪 Cancel &amp; Back to Lobby
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE GAME VIEW */}
      {view === 'PLAYING' && (
        <div className="gameplay-container">
          {/* PLAYER HUD */}
          <div className="player-hud">
            {/* Player X Card */}
            <div
              className={`player-card player-x ${
                currentTurn === 'X' ? 'active-turn' : ''
              } ${mySymbol === 'X' ? 'is-self' : ''}`}
            >
              <div className="player-avatar-box symbol-x">
                <span>X</span>
              </div>
              <div className="player-details">
                <span className="player-badge">
                  {mySymbol === 'X' ? 'YOU' : 'OPPONENT'}
                </span>
                <span className="player-name">{playerXName}</span>
              </div>
            </div>

            {/* Match VS Badge & Turn Timer */}
            <div className="match-timer-box">
              <div className="vs-badge">VS</div>
              <div className="turn-indicator">
                <span className="turn-label">
                  Turn:{' '}
                  <strong
                    className={
                      currentTurn === 'X' ? 'cyan-text' : 'magenta-text'
                    }
                  >
                    Player {currentTurn}
                  </strong>
                </span>
                {isMyTurn && (
                  <span className="your-turn-pill">YOUR TURN</span>
                )}
              </div>

              {/* 30s Countdown Bar */}
              <div className="timer-bar-wrapper">
                <div
                  className={`timer-bar-fill ${
                    turnTimer <= 5 ? 'timer-danger' : ''
                  }`}
                  style={{ width: `${(turnTimer / 30) * 100}%` }}
                ></div>
              </div>
              <span className="timer-seconds">{turnTimer}s remaining</span>
            </div>

            {/* Player O Card */}
            <div
              className={`player-card player-o ${
                currentTurn === 'O' ? 'active-turn' : ''
              } ${mySymbol === 'O' ? 'is-self' : ''}`}
            >
              <div className="player-avatar-box symbol-o">
                <span>O</span>
              </div>
              <div className="player-details">
                <span className="player-badge">
                  {mySymbol === 'O' ? 'YOU' : 'OPPONENT'}
                </span>
                <span className="player-name">{playerOName}</span>
              </div>
            </div>
          </div>

          {/* INTERACTIVE 3X3 NEON GRID */}
          <div className="grid-arena-wrapper">
            <div className="grid-arena">
              {board.map((cellValue, idx) => {
                const isWinningCell =
                  winningPattern && winningPattern.includes(idx);
                const showGhost =
                  !cellValue &&
                  isMyTurn &&
                  hoveredCell === idx;

                return (
                  <button
                    key={idx}
                    type="button"
                    className={`grid-cell ${
                      cellValue ? `filled-${cellValue.toLowerCase()}` : ''
                    } ${isWinningCell ? 'winning-cell' : ''}`}
                    onClick={() => handleCellClick(idx)}
                    onMouseEnter={() => setHoveredCell(idx)}
                    onMouseLeave={() => setHoveredCell(null)}
                    disabled={Boolean(cellValue) || !isMyTurn || isGameOver}
                    aria-label={`Cell ${idx} ${cellValue || 'empty'}`}
                  >
                    {/* Rendered Symbol */}
                    {cellValue === 'X' && (
                      <span className="symbol-svg symbol-svg-x animate-pop">
                        ✕
                      </span>
                    )}
                    {cellValue === 'O' && (
                      <span className="symbol-svg symbol-svg-o animate-pop">
                        ◯
                      </span>
                    )}

                    {/* Ghost preview */}
                    {showGhost && (
                      <span
                        className={`symbol-ghost ${
                          mySymbol === 'X' ? 'ghost-x' : 'ghost-o'
                        }`}
                      >
                        {mySymbol === 'X' ? '✕' : '◯'}
                      </span>
                    )}
                  </button>
                );
              })}

              {/* Strike-through line */}
              {winningPattern && (
                <div
                  className={`win-strike-line ${getStrikeThroughClass()}`}
                ></div>
              )}
            </div>
          </div>

          {/* Quick Controls Under Grid */}
          <div className="match-controls">
            <button
              type="button"
              className="ctrl-btn"
              onClick={restartGame}
              title="Reset match"
            >
              🔄 Reset Board
            </button>
            <button
              type="button"
              className="ctrl-btn ctrl-leave"
              onClick={returnToLobby}
              title="Leave match"
            >
              🚪 Exit to Lobby
            </button>
            {roomCode && roomCode !== 'LOCAL_AI' && (
              <span className="room-id-tag">Room: {roomCode}</span>
            )}
          </div>

          {/* GAME OVER MODAL */}
          {isGameOver && (
            <div className="game-over-overlay">
              <div
                className={`game-over-modal ${
                  winner === mySymbol
                    ? 'modal-victory'
                    : winner === 'DRAW'
                    ? 'modal-draw'
                    : 'modal-defeat'
                }`}
              >
                <div className="game-over-icon">
                  {winner === mySymbol && '🏆'}
                  {winner === 'DRAW' && '🤝'}
                  {winner && winner !== mySymbol && winner !== 'DRAW' && '💀'}
                </div>

                <h2 className="game-over-headline">
                  {winner === mySymbol && 'VICTORY!'}
                  {winner === 'DRAW' && 'STALEMATE!'}
                  {winner && winner !== mySymbol && winner !== 'DRAW' && 'DEFEAT!'}
                </h2>

                <p className="game-over-desc">
                  {winner === mySymbol && 'Flawless execution! You dominated the grid.'}
                  {winner === 'DRAW' && 'A battle of masterminds! The board is completely tied.'}
                  {winner && winner !== mySymbol && winner !== 'DRAW' && 'Opponent completed three-in-a-row. Better luck next round!'}
                </p>

                <div className="game-over-actions">
                  <button
                    type="button"
                    className="mode-btn btn-neon-cyan"
                    onClick={restartGame}
                  >
                    🔄 Play Again / Rematch
                  </button>
                  <button
                    type="button"
                    className="mode-btn btn-outline"
                    onClick={returnToLobby}
                  >
                    🚪 Back to Lobby
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TicTacToeLobby;

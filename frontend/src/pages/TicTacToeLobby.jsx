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

const REALISTIC_BOT_NAMES = [
  'Aarav_Sharma',
  'Vikram_R',
  'Sneha_Patel',
  'CyberNinja99',
  'Rohan_Verma',
  'Priya_K',
  'Aditya_M',
  'Neha_Singh',
];

const TicTacToeLobby = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  // Active view: 'LOBBY' | 'WAITING_ROOM' | 'PLAYING'
  const [view, setView] = useState('LOBBY');
  const [gameMode, setGameMode] = useState('QUICK_MATCH'); // 'QUICK_MATCH' | 'PRIVATE'

  // Room & Host/Guest state
  const [isHost, setIsHost] = useState(false);
  const [isReady, setIsReady] = useState(false); // Guest's own ready state
  const [opponentReady, setOpponentReady] = useState(false); // Opponent's ready state
  const [opponentJoined, setOpponentJoined] = useState(false); // Whether opponent has connected
  const [roomCode, setRoomCode] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState(() => {
    return (searchParams.get('room') || '').trim().toUpperCase();
  });
  const [mySymbol, setMySymbol] = useState('X');
  const [playerXName, setPlayerXName] = useState('Player X');
  const [playerOName, setPlayerOName] = useState('Player O');
  const [isAiOpponent, setIsAiOpponent] = useState(false);
  const [showExitConfirmModal, setShowExitConfirmModal] = useState(false);

  // Quick match countdown
  const [isSearching, setIsSearching] = useState(false);
  const [searchCountdown, setSearchCountdown] = useState(12);

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

  // State refs for async callbacks & websockets
  const boardRef = useRef(board);
  const currentTurnRef = useRef(currentTurn);
  const isGameOverRef = useRef(isGameOver);
  const mySymbolRef = useRef(mySymbol);
  const isHostRef = useRef(isHost);
  const sessionIdRef = useRef(sessionId);
  const playerIdRef = useRef(user?.userId || 'GUEST_LOCAL');
  const playerNameRef = useRef(user?.displayName || 'Player');
  const viewRef = useRef(view);
  const searchTimerRef = useRef(null);
  const hasAutoJoinedRef = useRef(false);

  const playerId = user?.userId || 'GUEST_LOCAL';
  const playerName = user?.displayName || 'Player';

  useEffect(() => {
    boardRef.current = board;
    currentTurnRef.current = currentTurn;
    isGameOverRef.current = isGameOver;
    mySymbolRef.current = mySymbol;
    isHostRef.current = isHost;
    sessionIdRef.current = sessionId;
    playerIdRef.current = playerId;
    playerNameRef.current = playerName;
    viewRef.current = view;
  }, [board, currentTurn, isGameOver, mySymbol, isHost, sessionId, playerId, playerName, view]);

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

    if (!isAiOpponent && sessionId) {
      tictactoeSocket.requestRematch(sessionId, playerId, mySymbol);
    }

    if (isAiOpponent && mySymbol === 'O') {
      scheduleAiMove(INITIAL_BOARD, 'X');
    }
  }, [sessionId, playerId, mySymbol, isAiOpponent, scheduleAiMove]);

  // WebSocket incoming message handler
  const handleSocketMessage = useCallback(
    (payload) => {
      if (!payload) return;
      const eventType = payload.eventType || payload.type;
      const session = payload.session || {};
      const serverBoard = session.board || payload.board;
      const nextTurn = session.currentTurn || payload.nextTurn;

      if (eventType === 'PLAYER_JOINED') {
        // Someone joined the private room
        const incomingPlayerId = payload.playerId || (session.playerO);
        if (incomingPlayerId !== playerIdRef.current) {
          const guestName = payload.playerName || session.playerOName || payload.playerO || 'Challenger';
          setPlayerOName(guestName);
          setOpponentJoined(true);
          setStatusMessage(`${guestName} joined the room!`);

          // If Host, announce host presence and identity back
          if (isHostRef.current) {
            tictactoeSocket.sendRoomEvent(sessionIdRef.current, {
              type: 'HOST_INFO',
              eventType: 'HOST_INFO',
              playerName: playerNameRef.current,
              playerId: playerIdRef.current,
            });
          }
        }
      } else if (eventType === 'HOST_INFO') {
        if (!isHostRef.current && payload.playerName) {
          setPlayerXName(payload.playerName);
        }
      } else if (eventType === 'PLAYER_READY') {
        if (payload.playerId !== playerIdRef.current) {
          setOpponentReady(Boolean(payload.isReady));
          setStatusMessage(
            payload.isReady
              ? `${payload.playerName || 'Opponent'} is ready to battle!`
              : `${payload.playerName || 'Opponent'} is not ready.`
          );
        }
      } else if (eventType === 'START_MATCH') {
        // Transition both host and guest immediately into PLAYING
        setBoard(INITIAL_BOARD);
        setCurrentTurn('X');
        setTurnTimer(30);
        setIsGameOver(false);
        setWinner(null);
        setWinningPattern(null);
        setView('PLAYING');
        setStatusMessage(
          mySymbolRef.current === 'X'
            ? 'Match started! Your move (X).'
            : 'Match started! Host moves first (X).'
        );
      } else if (eventType === 'MOVE_MADE' || eventType === 'MOVE' || payload.position !== undefined) {
        if (serverBoard && Array.isArray(serverBoard)) {
          setBoard(serverBoard);
          const outcome = session.winner
            ? { winner: session.winner, winningPattern: session.winningPattern }
            : checkWinner(serverBoard);
          if (outcome && outcome.winner) {
            handleGameOver(outcome);
            return;
          }
        } else if (payload.position !== undefined && payload.symbol) {
          setBoard((prev) => {
            const next = [...prev];
            next[payload.position] = payload.symbol;
            const outcome = checkWinner(next);
            if (outcome && outcome.winner) {
              handleGameOver(outcome);
            }
            return next;
          });
        }
        setTurnTimer(30);
        if (nextTurn) {
          setCurrentTurn(nextTurn);
        } else {
          setCurrentTurn((prev) => (prev === 'X' ? 'O' : 'X'));
        }
      } else if (eventType === 'GAME_OVER') {
        handleGameOver({
          winner: payload.winner || session.winner,
          winningPattern: payload.winningPattern || session.winningPattern,
        });
      } else if (eventType === 'MATCH_FORFEITED') {
        setStatusMessage(`⚠️ ${payload.forfeiter || 'Opponent'} forfeited the match.`);
        handleGameOver({
          winner: mySymbolRef.current,
          winningPattern: null,
        });
      } else if (eventType === 'REMATCH_ACCEPTED' || eventType === 'REMATCH_START') {
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
      if (searchTimerRef.current) {
        clearInterval(searchTimerRef.current);
      }
      tictactoeSocket.disconnect();
    };
  }, []);

  // Quick Match: Pair with simulated realistic player
  const pairWithSimulatedPlayer = useCallback(() => {
    setIsSearching(false);
    const botName = REALISTIC_BOT_NAMES[Math.floor(Math.random() * REALISTIC_BOT_NAMES.length)];
    const assignedSymbol = 'X'; // User plays as X
    setMySymbol(assignedSymbol);
    setPlayerXName(playerName);
    setPlayerOName(botName); // Shows realistic name like 'Aarav_Sharma' without [AI]
    setIsAiOpponent(true); // AI runs under the hood

    const mockSessionId = `OWG_QM_${Date.now()}`;
    const mockRoomCode = `QM-${Math.floor(1000 + Math.random() * 9000)}`;
    setSessionId(mockSessionId);
    setRoomCode(mockRoomCode);

    setBoard(INITIAL_BOARD);
    setCurrentTurn('X');
    setTurnTimer(30);
    setIsGameOver(false);
    setWinner(null);
    setWinningPattern(null);
    setView('PLAYING');
    setStatusMessage(`Challenger found: ${botName}! Your move (X).`);
  }, [playerName]);

  // Start Quick Match with 12s countdown
  const startQuickMatch = useCallback(() => {
    setGameMode('QUICK_MATCH');
    setIsSearching(true);
    setSearchCountdown(12);
    setStatusMessage('');

    if (searchTimerRef.current) {
      clearInterval(searchTimerRef.current);
    }

    let remaining = 12;
    // Choose realistic finish time (10-12s elapsed, i.e., 0-2s remaining)
    const finishAtRemaining = Math.floor(Math.random() * 2);

    searchTimerRef.current = setInterval(() => {
      remaining -= 1;
      setSearchCountdown(remaining);

      if (remaining <= finishAtRemaining) {
        clearInterval(searchTimerRef.current);
        searchTimerRef.current = null;
        pairWithSimulatedPlayer();
      }
    }, 1000);
  }, [pairWithSimulatedPlayer]);

  // Cancel Quick Match
  const cancelQuickMatch = useCallback(() => {
    if (searchTimerRef.current) {
      clearInterval(searchTimerRef.current);
      searchTimerRef.current = null;
    }
    setIsSearching(false);
    setSearchCountdown(12);
    setStatusMessage('Matchmaking cancelled.');
  }, []);

  // Create Private Room (Host)
  const createPrivateRoom = async () => {
    setLoading(true);
    setStatusMessage('Creating private room...');
    setGameMode('PRIVATE');
    setIsHost(true);
    setIsReady(true);
    setOpponentReady(false);
    setOpponentJoined(false);
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
      setStatusMessage('Error creating room. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Join Private Room (Guest)
  const joinPrivateRoom = useCallback(
    async (codeToJoin) => {
      const code = (codeToJoin || joinCodeInput).trim().toUpperCase();
      if (!code) {
        setStatusMessage('Please enter a valid room code.');
        return;
      }
      setLoading(true);
      setStatusMessage(`Connecting to room ${code}...`);
      setGameMode('PRIVATE');
      setIsHost(false);
      setIsReady(false);
      setOpponentReady(false);
      setOpponentJoined(true);
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
          onConnect: () => {
            // Inform host that guest joined!
            tictactoeSocket.sendRoomEvent(res.sessionId, {
              type: 'PLAYER_JOINED',
              symbol: 'O',
              playerId,
              playerName,
            });
          },
          onMessage: handleSocketMessage,
          onError: () => {},
        });

        // Crucial fix: Guest STAYS in WAITING_ROOM! DO NOT setView('PLAYING')
        setView('WAITING_ROOM');
        setStatusMessage(`Joined room ${code}! Click "I'm Ready" when prepared.`);
      } catch (err) {
        console.error('Join room error:', err);
        const isFull = /full|maximum|already/i.test(err.message || '');
        if (isFull) {
          setStatusMessage('⚠️ Room is full! Maximum 2 players already joined.');
        } else {
          setStatusMessage(err.message || 'Could not join room. Check the code and try again.');
        }
      } finally {
        setLoading(false);
      }
    },
    [joinCodeInput, playerId, playerName, handleSocketMessage]
  );

  // Auto-join if room query parameter is present on initial mount
  useEffect(() => {
    const roomFromUrl = (searchParams.get('room') || '').trim().toUpperCase();
    if (roomFromUrl && !hasAutoJoinedRef.current && view === 'LOBBY' && !sessionId) {
      hasAutoJoinedRef.current = true;
      joinPrivateRoom(roomFromUrl);
    }
  }, [searchParams, view, sessionId, joinPrivateRoom]);

  // Guest toggle ready
  const handleToggleReady = () => {
    const nextReady = !isReady;
    setIsReady(nextReady);
    tictactoeSocket.sendPlayerReady(sessionId, playerId, mySymbol, nextReady);
  };

  // Host starts match (only enabled if opponentJoined && opponentReady)
  const handleHostStartMatch = () => {
    if (!opponentJoined || !opponentReady) return;
    tictactoeSocket.sendStartMatch(sessionId);
    // Transition Host immediately to avoid network delay
    setBoard(INITIAL_BOARD);
    setCurrentTurn('X');
    setTurnTimer(30);
    setIsGameOver(false);
    setWinner(null);
    setWinningPattern(null);
    setView('PLAYING');
    setStatusMessage('Match started! Your move (X).');
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

    const outcome = checkWinner(newBoard);
    const nextTurn = mySymbol === 'X' ? 'O' : 'X';
    setCurrentTurn(nextTurn);

    if (!isAiOpponent && sessionId) {
      tictactoeSocket.sendMove(sessionId, playerId, index, mySymbol);
      // Direct peer broadcast for sub-50ms synchronized UI across both screens
      tictactoeSocket.sendRoomEvent(sessionId, {
        type: 'MOVE_MADE',
        eventType: 'MOVE_MADE',
        position: index,
        symbol: mySymbol,
        nextTurn,
        board: newBoard,
        turnTimer: 30,
      });
    }

    if (outcome) {
      handleGameOver(outcome);
      return;
    }

    if (isAiOpponent) {
      scheduleAiMove(newBoard, nextTurn);
    }
  };

  // Exit match handler with confirmation
  const handleExitMatchClick = () => {
    if (view === 'PLAYING' && !isGameOver) {
      setShowExitConfirmModal(true);
    } else {
      returnToLobby();
    }
  };

  // Return to Lobby
  const returnToLobby = () => {
    setShowExitConfirmModal(false);
    if (searchTimerRef.current) {
      clearInterval(searchTimerRef.current);
      searchTimerRef.current = null;
    }
    if (!isAiOpponent && sessionId && view === 'PLAYING' && !isGameOver) {
      tictactoeSocket.sendRoomEvent(sessionId, {
        type: 'MATCH_FORFEITED',
        eventType: 'MATCH_FORFEITED',
        forfeiter: playerName,
      });
    }
    tictactoeSocket.disconnect();
    setView('LOBBY');
    setIsSearching(false);
    setSearchCountdown(12);
    setBoard(INITIAL_BOARD);
    setIsGameOver(false);
    setWinner(null);
    setWinningPattern(null);
    setRoomCode('');
    setSessionId('');
    setIsHost(false);
    setIsReady(false);
    setOpponentReady(false);
    setOpponentJoined(false);
    setIsAiOpponent(false);
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

      {/* LOBBY VIEW - Exactly 2 options */}
      {view === 'LOBBY' && (
        <div className="lobby-hero">
          <div className="lobby-hero-badge">
            <span className="badge-pulse-dot"></span> Real-Time 1v1 PvP
          </div>

          <h1 className="lobby-title">Tic-Tac-Toe Arena</h1>
          <p className="lobby-subtitle">
            Stateless microservice multiplayer with instant matchmaking and private room invites.
          </p>

          {/* Action Cards Grid - Exactly 2 options */}
          <div className="modes-grid two-cards-grid">
            {/* 1. Quick Match Card */}
            <div className="mode-card primary-card">
              <div className="mode-card-icon">⚡</div>
              <h3>Quick Match</h3>
              <p>Instantly match with an online challenger in random matchmaking queue.</p>

              {isSearching ? (
                <div className="matchmaking-search-container">
                  <div className="matchmaking-search-header">
                    <span className="search-pulse-ring"></span>
                    <span className="search-pulse-dot"></span>
                    <span className="matchmaking-timer-text">
                      🔍 Searching for online challenger... ({searchCountdown}s)
                    </span>
                  </div>
                  <div className="matchmaking-progress-track">
                    <div
                      className="matchmaking-progress-bar"
                      style={{ width: `${((12 - searchCountdown) / 12) * 100}%` }}
                    ></div>
                  </div>
                  <button
                    type="button"
                    className="mode-btn btn-outline cancel-search-btn"
                    onClick={cancelQuickMatch}
                  >
                    ❌ Cancel Search
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="mode-btn btn-neon-cyan"
                  onClick={startQuickMatch}
                  disabled={loading}
                >
                  ⚡ Find Random Opponent
                </button>
              )}
            </div>

            {/* 2. Private Room Card */}
            <div className="mode-card highlight-card private-room-card">
              <div className="mode-card-icon">🔗</div>
              <h3>Private Room</h3>
              <p>Play with a coworker or friend via custom room code or direct invite link.</p>

              <div className="private-room-subactions">
                <div className="subaction-section">
                  <span className="subaction-label">Host a New Match</span>
                  <button
                    type="button"
                    className="mode-btn btn-neon-magenta"
                    onClick={createPrivateRoom}
                    disabled={loading || isSearching}
                  >
                    ➕ Create Room
                  </button>
                </div>

                <div className="subactions-divider">
                  <span>OR JOIN BY CODE</span>
                </div>

                <div className="subaction-section">
                  <span className="subaction-label">Enter Room Code</span>
                  <div className="join-form-inline">
                    <input
                      type="text"
                      placeholder="e.g. TTT-7X9B"
                      value={joinCodeInput}
                      onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                      maxLength={10}
                      className="join-input inline-join-input"
                      disabled={loading || isSearching}
                    />
                    <button
                      type="button"
                      className="mode-btn btn-outline join-inline-btn"
                      onClick={() => joinPrivateRoom()}
                      disabled={loading || isSearching || !joinCodeInput.trim()}
                    >
                      🔑 Join Room
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {statusMessage && (
            <div className="status-toast" role="status">
              {statusMessage}
            </div>
          )}
        </div>
      )}

      {/* WAITING ROOM VIEW (Host vs Guest) */}
      {view === 'WAITING_ROOM' && (
        <div className="lobby-hero waiting-hero">
          <div className="waiting-container">
            {isHost ? (
              /* HOST WAITING UI */
              <>
                <span className="lobby-status-tag">👑 Room Host</span>
                <h2 className="waiting-title">Room {roomCode}</h2>
                <p className="waiting-desc">
                  Share the room code or link. The match will start once your challenger joins and marks as Ready.
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

                {/* Opponent Status Box */}
                <div className="waiting-opponent-card">
                  <div className="opponent-avatar-row">
                    <div className="opponent-avatar-icon">
                      {opponentJoined ? '⚔️' : '⏳'}
                    </div>
                    <div className="opponent-meta-info">
                      <span className="opponent-label">Challenger:</span>
                      <span className="opponent-display-name">
                        {opponentJoined ? playerOName : 'Waiting for opponent to join...'}
                      </span>
                    </div>
                    {opponentJoined && (
                      <span className={`ready-badge ${opponentReady ? 'badge-ready' : 'badge-not-ready'}`}>
                        {opponentReady ? '🟢 Ready' : '⏳ Not Ready'}
                      </span>
                    )}
                  </div>

                  {!opponentJoined ? (
                    <div className="pulsing-indicator-box">
                      <div className="pulse-ring"></div>
                      <div className="pulse-dot"></div>
                      <span className="pulsing-text">Waiting for opponent to connect...</span>
                    </div>
                  ) : (
                    <div className="ready-status-note">
                      {opponentReady
                        ? '🟢 Opponent is ready! Click "Start Match" below to begin.'
                        : `⏳ Waiting for ${playerOName} to mark as Ready...`}
                    </div>
                  )}
                </div>

                {/* Host Actions */}
                <div className="waiting-actions">
                  <button
                    type="button"
                    className="mode-btn btn-neon-green start-match-btn"
                    onClick={handleHostStartMatch}
                    disabled={!opponentJoined || !opponentReady}
                  >
                    🚀 Start Match
                  </button>
                  <button
                    type="button"
                    className="mode-btn btn-outline"
                    onClick={returnToLobby}
                  >
                    🚪 Cancel &amp; Back to Lobby
                  </button>
                </div>
              </>
            ) : (
              /* GUEST WAITING UI */
              <>
                <span className="lobby-status-tag guest-tag">🎯 Challenger (Player O)</span>
                <h2 className="waiting-title">Room {roomCode}</h2>
                <p className="waiting-desc">
                  You are connected to the room! Mark yourself as Ready so the Host can launch the game.
                </p>

                <div className="guest-room-info-card">
                  <div className="host-info-row">
                    <span className="host-label">👑 Room Host:</span>
                    <strong className="host-name">{playerXName || 'Host'}</strong>
                    <span className="host-status-badge">🟢 Connected</span>
                  </div>
                  <div className="room-code-mini">
                    <span>Room Code: <strong>{roomCode}</strong></span>
                  </div>
                </div>

                <div className="guest-ready-card">
                  <button
                    type="button"
                    className={`mode-btn guest-ready-toggle-btn ${
                      isReady ? 'btn-neon-green is-ready-active' : 'btn-neon-cyan'
                    }`}
                    onClick={handleToggleReady}
                  >
                    {isReady ? "🟢 I'm Ready (Click to Unready)" : '⏳ Mark as Ready'}
                  </button>

                  <p className="guest-ready-subtext">
                    {isReady
                      ? '✅ You are marked as Ready! Waiting for Host to start match...'
                      : 'Click the button above to let the Host know you are ready to play.'}
                  </p>
                </div>

                <div className="waiting-actions">
                  <button
                    type="button"
                    className="mode-btn btn-outline"
                    onClick={returnToLobby}
                  >
                    🚪 Leave Room &amp; Back to Lobby
                  </button>
                </div>
              </>
            )}
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
              onClick={handleExitMatchClick}
              title="Leave match"
            >
              🚪 Exit to Lobby
            </button>
            {roomCode && (
              <span className="room-id-tag">Room: {roomCode}</span>
            )}
          </div>

          {/* EXIT CONFIRMATION MODAL */}
          {showExitConfirmModal && (
            <div className="game-over-overlay">
              <div className="game-over-modal modal-defeat" style={{ maxWidth: '420px', textAlign: 'center' }}>
                <div className="game-over-icon">⚠️</div>
                <h2 className="game-over-headline" style={{ color: '#ff007f' }}>Exit Match?</h2>
                <p className="game-over-desc">
                  Are you sure you want to forfeit and exit? Exiting an active match ends the game for both players.
                </p>
                <div className="game-over-actions">
                  <button
                    type="button"
                    className="mode-btn btn-neon-cyan"
                    onClick={() => setShowExitConfirmModal(false)}
                  >
                    Keep Playing
                  </button>
                  <button
                    type="button"
                    className="mode-btn btn-neon-magenta"
                    onClick={returnToLobby}
                  >
                    Yes, Forfeit & Exit
                  </button>
                </div>
              </div>
            </div>
          )}

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

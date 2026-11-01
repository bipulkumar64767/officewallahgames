import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import confetti from 'canvas-confetti';
import GameRulesModal from '../components/GameRulesModal';
import './SpeedChess.css';

const INITIAL_PIECES = [
  ['♜', '♞', '♝', '♛', '♚', '♝', '♞', '♜'],
  ['♟', '♟', '♟', '♟', '♟', '♟', '♟', '♟'],
  ['', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', ''],
  ['♙', '♙', '♙', '♙', '♙', '♙', '♙', '♙'],
  ['♖', '♘', '♗', '♕', '♔', '♗', '♘', '♖'],
];

const WHITE_PIECES = new Set(['♔', '♕', '♖', '♗', '♘', '♙']);
const BLACK_PIECES = new Set(['♚', '♛', '♜', '♝', '♞', '♟']);

const playTone = (freq, duration, type = 'sine', volume = 0.12) => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Autoplay policy fallback
  }
};

export default function SpeedChess() {
  const [searchParams] = useSearchParams();
  const [board, setBoard] = useState(INITIAL_PIECES);
  const [selectedSquare, setSelectedSquare] = useState(null); // { r, c }
  const [validMoves, setValidMoves] = useState([]); // [{ r, c }]
  const [currentTurn, setCurrentTurn] = useState('WHITE'); // 'WHITE' | 'BLACK'
  const [gameMode, setGameMode] = useState('AI'); // 'AI' | 'PASS_PLAY' | 'ROOM'
  const [whiteTimer, setWhiteTimer] = useState(300); // 5 min blitz
  const [blackTimer, setBlackTimer] = useState(300);
  const [isGameOver, setIsGameOver] = useState(false);
  const [winner, setWinner] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [roomCode] = useState(() => (searchParams.get('room') || 'CHS-7821').toUpperCase());
  const [voiceJoined, setVoiceJoined] = useState(false);
  const [micMuted, setMicMuted] = useState(false);

  const timerRef = useRef(null);

  const soundFx = useCallback((type) => {
    if (!soundEnabled) return;
    if (type === 'move') playTone(440, 0.06, 'sine', 0.1);
    else if (type === 'capture') playTone(580, 0.1, 'triangle', 0.18);
    else if (type === 'check') playTone(780, 0.2, 'sawtooth', 0.15);
    else if (type === 'win') {
      playTone(523.25, 0.15, 'sine', 0.15);
      setTimeout(() => playTone(659.25, 0.2, 'sine', 0.18), 120);
      setTimeout(() => playTone(783.99, 0.35, 'triangle', 0.22), 240);
    }
  }, [soundEnabled]);

  // Turn timer interval
  useEffect(() => {
    if (isGameOver) return;
    timerRef.current = setInterval(() => {
      if (currentTurn === 'WHITE') {
        setWhiteTimer((t) => {
          if (t <= 1) {
            handleTimeout('BLACK');
            return 0;
          }
          return t - 1;
        });
      } else {
        setBlackTimer((t) => {
          if (t <= 1) {
            handleTimeout('WHITE');
            return 0;
          }
          return t - 1;
        });
      }
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [currentTurn, isGameOver]);

  const handleTimeout = (wonColor) => {
    setIsGameOver(true);
    setWinner(wonColor);
    soundFx('win');
  };

  const restartGame = () => {
    setBoard(INITIAL_PIECES);
    setSelectedSquare(null);
    setValidMoves([]);
    setCurrentTurn('WHITE');
    setWhiteTimer(300);
    setBlackTimer(300);
    setIsGameOver(false);
    setWinner(null);
    soundFx('move');
  };

  // Compute basic legal moves for standard chess
  const getMovesForPiece = (r, c, b = board) => {
    const piece = b[r][c];
    if (!piece) return [];
    const isWhite = WHITE_PIECES.has(piece);
    const moves = [];

    const isEnemy = (targetR, targetC) => {
      const p = b[targetR][targetC];
      return p && (isWhite ? BLACK_PIECES.has(p) : WHITE_PIECES.has(p));
    };

    const isEmpty = (targetR, targetC) => !b[targetR][targetC];

    const addMove = (targetR, targetC) => {
      if (targetR < 0 || targetR >= 8 || targetC < 0 || targetC >= 8) return false;
      if (isEmpty(targetR, targetC)) {
        moves.push({ r: targetR, c: targetC });
        return true;
      }
      if (isEnemy(targetR, targetC)) {
        moves.push({ r: targetR, c: targetC });
      }
      return false; // Stopped by piece
    };

    // Pawns
    if (piece === '♙') {
      if (isEmpty(r - 1, c)) {
        moves.push({ r: r - 1, c });
        if (r === 6 && isEmpty(r - 2, c)) moves.push({ r: r - 2, c });
      }
      if (c > 0 && isEnemy(r - 1, c - 1)) moves.push({ r: r - 1, c: c - 1 });
      if (c < 7 && isEnemy(r - 1, c + 1)) moves.push({ r: r - 1, c: c + 1 });
    } else if (piece === '♟') {
      if (isEmpty(r + 1, c)) {
        moves.push({ r: r + 1, c });
        if (r === 1 && isEmpty(r + 2, c)) moves.push({ r: r + 2, c });
      }
      if (c > 0 && isEnemy(r + 1, c - 1)) moves.push({ r: r + 1, c: c - 1 });
      if (c < 7 && isEnemy(r + 1, c + 1)) moves.push({ r: r + 1, c: c + 1 });
    }
    // Knights
    else if (piece === '♘' || piece === '♞') {
      const knightOffsets = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1],
      ];
      knightOffsets.forEach(([dr, dc]) => addMove(r + dr, c + dc));
    }
    // Rooks & Queens
    if (['♖', '♜', '♕', '♛'].includes(piece)) {
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      dirs.forEach(([dr, dc]) => {
        let step = 1;
        while (addMove(r + dr * step, c + dc * step)) step++;
      });
    }
    // Bishops & Queens
    if (['♗', '♝', '♕', '♛'].includes(piece)) {
      const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
      dirs.forEach(([dr, dc]) => {
        let step = 1;
        while (addMove(r + dr * step, c + dc * step)) step++;
      });
    }
    // Kings
    if (piece === '♔' || piece === '♚') {
      const dirs = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],           [0, 1],
        [1, -1],  [1, 0],  [1, 1],
      ];
      dirs.forEach(([dr, dc]) => addMove(r + dr, c + dc));
    }

    return moves;
  };

  const handleSquareClick = (r, c) => {
    if (isGameOver) return;
    if (gameMode === 'AI' && currentTurn === 'BLACK') return;

    const piece = board[r][c];
    const isWhiteTurn = currentTurn === 'WHITE';
    const isOwnPiece = piece && (isWhiteTurn ? WHITE_PIECES.has(piece) : BLACK_PIECES.has(piece));

    // If already selected and clicked a valid move target
    if (selectedSquare) {
      const isTargetValid = validMoves.some((m) => m.r === r && m.c === c);
      if (isTargetValid) {
        executeMove(selectedSquare.r, selectedSquare.c, r, c);
        return;
      }
    }

    // Otherwise select own piece
    if (isOwnPiece) {
      setSelectedSquare({ r, c });
      setValidMoves(getMovesForPiece(r, c));
      soundFx('move');
    } else {
      setSelectedSquare(null);
      setValidMoves([]);
    }
  };

  const executeMove = (fromR, fromC, toR, toC) => {
    const newBoard = board.map((row) => [...row]);
    const movingPiece = newBoard[fromR][fromC];
    const capturedPiece = newBoard[toR][toC];

    // Move piece
    newBoard[toR][toC] = movingPiece;
    newBoard[fromR][fromC] = '';

    // Pawn Promotion to Queen
    if (movingPiece === '♙' && toR === 0) newBoard[toR][toC] = '♕';
    if (movingPiece === '♟' && toR === 7) newBoard[toR][toC] = '♛';

    setBoard(newBoard);
    setSelectedSquare(null);
    setValidMoves([]);

    const didCapture = Boolean(capturedPiece);
    soundFx(didCapture ? 'capture' : 'move');

    // Check for King capture / win
    if (capturedPiece === '♚') {
      setIsGameOver(true);
      setWinner('WHITE');
      soundFx('win');
      try { confetti({ particleCount: 60, spread: 80 }); } catch (_) {}
      return;
    } else if (capturedPiece === '♔') {
      setIsGameOver(true);
      setWinner('BLACK');
      soundFx('win');
      return;
    }

    const nextTurn = currentTurn === 'WHITE' ? 'BLACK' : 'WHITE';
    setCurrentTurn(nextTurn);

    // AI Move trigger
    if (gameMode === 'AI' && nextTurn === 'BLACK') {
      setTimeout(() => makeAiMove(newBoard), 400);
    }
  };

  // Simple Stockfish-lite AI
  const makeAiMove = (currentBoard) => {
    const allAiMoves = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = currentBoard[r][c];
        if (piece && BLACK_PIECES.has(piece)) {
          const pieceMoves = getMovesForPiece(r, c, currentBoard);
          pieceMoves.forEach((m) => {
            const targetPiece = currentBoard[m.r][m.c];
            // Prioritize captures
            const score = targetPiece ? (targetPiece === '♔' ? 100 : 10) : 1;
            allAiMoves.push({ from: { r, c }, to: m, score });
          });
        }
      }
    }

    if (allAiMoves.length === 0) {
      setIsGameOver(true);
      setWinner('WHITE');
      soundFx('win');
      return;
    }

    // Sort by score and pick best
    allAiMoves.sort((a, b) => b.score - a.score);
    const bestMove = allAiMoves[0];

    const newBoard = currentBoard.map((row) => [...row]);
    const movingPiece = newBoard[bestMove.from.r][bestMove.from.c];
    const captured = newBoard[bestMove.to.r][bestMove.to.c];

    newBoard[bestMove.to.r][bestMove.to.c] = movingPiece;
    newBoard[bestMove.from.r][bestMove.from.c] = '';
    if (movingPiece === '♟' && bestMove.to.r === 7) newBoard[bestMove.to.r][bestMove.to.c] = '♛';

    setBoard(newBoard);
    soundFx(captured ? 'capture' : 'move');

    if (captured === '♔') {
      setIsGameOver(true);
      setWinner('BLACK');
      soundFx('win');
      return;
    }

    setCurrentTurn('WHITE');
  };

  const formatTimer = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="chess-page-container">
      {/* Top Header Bar with Breadcrumb and Rules */}
      <div className="chess-top-bar">
        <nav className="chess-breadcrumb" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span>/</span>
          <Link to="/games">Games</Link>
          <span>/</span>
          <span className="breadcrumb-current">Speed Chess Arena</span>
        </nav>

        <button
          type="button"
          className="btn-rules-info"
          onClick={() => setShowRulesModal(true)}
          title="Game Rules & Regulations"
        >
          <span>ℹ️ Rules</span>
        </button>
      </div>

      {/* Game Rules Modal */}
      <GameRulesModal
        isOpen={showRulesModal}
        onClose={() => setShowRulesModal(false)}
        gameKey="speedchess"
      />

      {/* Main HUD Banner: Sound, Mic/Voice, Clocks, Mode */}
      <div className="chess-hud-banner">
        <div className="hud-player-item white-player">
          <span className="player-glyph">♔</span>
          <div className="player-meta-info">
            <span className="player-label">WHITE</span>
            <span className={`player-clock ${whiteTimer <= 30 ? 'critical' : ''}`}>
              ⏱️ {formatTimer(whiteTimer)}
            </span>
          </div>
          {currentTurn === 'WHITE' && !isGameOver && <span className="turn-pill">TURN</span>}
        </div>

        <div className="hud-banner-center">
          <div className="hud-pairing-selector">
            <button
              type="button"
              className={`mode-toggle-btn ${gameMode === 'AI' ? 'active' : ''}`}
              onClick={() => { setGameMode('AI'); restartGame(); }}
            >
              🤖 vs AI
            </button>
            <button
              type="button"
              className={`mode-toggle-btn ${gameMode === 'ROOM' ? 'active' : ''}`}
              onClick={() => { setGameMode('ROOM'); restartGame(); }}
            >
              🔗 Room
            </button>
          </div>

          <div className="hud-tools-row">
            <button
              type="button"
              className={`hud-tool-btn sound-toggle-btn ${!soundEnabled ? 'sound-off' : ''}`}
              onClick={() => setSoundEnabled((prev) => !prev)}
              title="Toggle Sound Effects"
            >
              {soundEnabled ? '🔊 Sound: ON' : '🔈 Sound: OFF'}
            </button>

            {gameMode === 'ROOM' && (
              <button
                type="button"
                className={`hud-tool-btn voice-btn ${voiceJoined ? 'voice-on' : ''}`}
                onClick={() => {
                  if (!voiceJoined) setVoiceJoined(true);
                  else setMicMuted((m) => !m);
                }}
                title="Voice Chat"
              >
                {!voiceJoined ? '🎙️ Voice: Join' : micMuted ? '🔇 Muted' : '🎙️ Mic ON'}
              </button>
            )}

            <button
              type="button"
              className="hud-tool-btn reset-btn"
              onClick={restartGame}
              title="Restart Match"
            >
              🔄
            </button>
          </div>
        </div>

        <div className="hud-player-item black-player">
          <span className="player-glyph">♚</span>
          <div className="player-meta-info">
            <span className="player-label">{gameMode === 'AI' ? 'CYBER AI' : 'BLACK'}</span>
            <span className={`player-clock ${blackTimer <= 30 ? 'critical' : ''}`}>
              ⏱️ {formatTimer(blackTimer)}
            </span>
          </div>
          {currentTurn === 'BLACK' && !isGameOver && <span className="turn-pill">TURN</span>}
        </div>
      </div>

      {/* Room Code Badge */}
      {gameMode === 'ROOM' && (
        <div className="chess-room-badge">
          <span>ROOM: <strong>{roomCode}</strong></span>
          <button
            type="button"
            className="copy-room-btn"
            onClick={() => navigator.clipboard.writeText(roomCode)}
          >
            📋 Copy Code
          </button>
        </div>
      )}

      {/* 8x8 Chessboard */}
      <div className="chessboard-shell">
        <div className="chessboard-grid">
          {board.map((row, r) =>
            row.map((piece, c) => {
              const isDark = (r + c) % 2 === 1;
              const isSelected = selectedSquare && selectedSquare.r === r && selectedSquare.c === c;
              const isValid = validMoves.some((m) => m.r === r && m.c === c);
              const isTargetEnemy = isValid && piece;

              return (
                <div
                  key={`sq-${r}-${c}`}
                  className={`chess-square ${isDark ? 'sq-dark' : 'sq-light'} ${
                    isSelected ? 'sq-selected' : ''
                  } ${isValid ? 'sq-valid-target' : ''}`}
                  onClick={() => handleSquareClick(r, c)}
                >
                  {piece && (
                    <span
                      className={`chess-piece ${
                        WHITE_PIECES.has(piece) ? 'piece-white' : 'piece-black'
                      }`}
                    >
                      {piece}
                    </span>
                  )}
                  {isValid && !isTargetEnemy && <div className="valid-dot" />}
                  {isTargetEnemy && <div className="enemy-target-ring" />}
                </div>
              );
            })
          )}
        </div>

        {/* Game Over Modal */}
        {isGameOver && (
          <div className="chess-overlay">
            <div className="game-over-icon">🏆</div>
            <h2 className="overlay-title">{winner} WINS!</h2>
            <p className="overlay-desc">
              {winner === 'WHITE' ? 'White dominates the arena!' : 'Black achieves strategic checkmate!'}
            </p>
            <div className="overlay-actions">
              <button
                type="button"
                className="btn-cyber-primary"
                onClick={restartGame}
                autoFocus
              >
                🔄 Play Again
              </button>
              <Link to="/games" className="btn-cyber-outline">
                🏠 Games Catalog
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

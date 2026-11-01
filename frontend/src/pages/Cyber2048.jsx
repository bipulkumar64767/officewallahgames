import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import confetti from 'canvas-confetti';
import GameRulesModal from '../components/GameRulesModal';
import './Cyber2048.css';

const GRID_SIZE = 4;

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

const getEmptyBoard = () =>
  Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));

const spawnTile = (board) => {
  const emptyCells = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (board[r][c] === 0) emptyCells.push({ r, c });
    }
  }
  if (emptyCells.length === 0) return board;
  const { r, c } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  const newBoard = board.map((row) => [...row]);
  newBoard[r][c] = Math.random() < 0.9 ? 2 : 4;
  return newBoard;
};

const initGame = () => {
  let board = getEmptyBoard();
  board = spawnTile(board);
  board = spawnTile(board);
  return board;
};

export default function Cyber2048() {
  const [board, setBoard] = useState(initGame);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(() => {
    return parseInt(localStorage.getItem('owg_2048_highscore') || '0', 10);
  });
  const [isGameOver, setIsGameOver] = useState(false);
  const [hasWon, setHasWon] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showRulesModal, setShowRulesModal] = useState(false);

  const touchStartRef = useRef({ x: 0, y: 0 });

  const soundFx = useCallback((type) => {
    if (!soundEnabled) return;
    if (type === 'slide') playTone(300, 0.05, 'sine', 0.08);
    else if (type === 'merge') playTone(520, 0.12, 'triangle', 0.15);
    else if (type === 'win') {
      playTone(587.33, 0.15, 'sine', 0.15);
      setTimeout(() => playTone(880, 0.3, 'triangle', 0.2), 120);
    } else if (type === 'over') {
      playTone(220, 0.35, 'sawtooth', 0.2);
    }
  }, [soundEnabled]);

  // Restart match
  const restartGame = () => {
    setBoard(initGame());
    setScore(0);
    setIsGameOver(false);
    setHasWon(false);
    soundFx('slide');
  };

  // Check if any valid moves remain
  const checkGameOver = (currentBoard) => {
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (currentBoard[r][c] === 0) return false;
        if (c < GRID_SIZE - 1 && currentBoard[r][c] === currentBoard[r][c + 1]) return false;
        if (r < GRID_SIZE - 1 && currentBoard[r][c] === currentBoard[r + 1][c]) return false;
      }
    }
    return true;
  };

  // Move tiles in direction: 'LEFT' | 'RIGHT' | 'UP' | 'DOWN'
  const move = useCallback((direction) => {
    if (isGameOver) return;

    let rotated = false;
    let current = board.map((row) => [...row]);

    // Transpose helper
    const transpose = (matrix) =>
      matrix[0].map((_, colIdx) => matrix.map((row) => row[colIdx]));

    // Reverse rows helper
    const reverseRows = (matrix) => matrix.map((row) => [...row].reverse());

    // Orient matrix so we always slide left
    if (direction === 'UP') {
      current = transpose(current);
    } else if (direction === 'DOWN') {
      current = reverseRows(transpose(current));
    } else if (direction === 'RIGHT') {
      current = reverseRows(current);
    }

    let pointsGained = 0;
    let didMerge = false;
    let moved = false;

    // Slide and merge left
    const newRows = current.map((row) => {
      // 1. Filter out zeros
      let nonZeros = row.filter((val) => val !== 0);
      let mergedRow = [];
      let i = 0;

      while (i < nonZeros.length) {
        if (i < nonZeros.length - 1 && nonZeros[i] === nonZeros[i + 1]) {
          const mergedVal = nonZeros[i] * 2;
          mergedRow.push(mergedVal);
          pointsGained += mergedVal;
          didMerge = true;
          if (mergedVal === 2048 && !hasWon) {
            setHasWon(true);
            try {
              confetti({ particleCount: 50, spread: 70, origin: { y: 0.5 } });
            } catch (_) {}
          }
          i += 2;
        } else {
          mergedRow.push(nonZeros[i]);
          i += 1;
        }
      }

      while (mergedRow.length < GRID_SIZE) {
        mergedRow.push(0);
      }

      if (row.some((val, idx) => val !== mergedRow[idx])) {
        moved = true;
      }

      return mergedRow;
    });

    if (!moved) return;

    // De-orient back to original configuration
    let result = newRows;
    if (direction === 'UP') {
      result = transpose(result);
    } else if (direction === 'DOWN') {
      result = transpose(reverseRows(result));
    } else if (direction === 'RIGHT') {
      result = reverseRows(result);
    }

    // Spawn new tile
    const finalBoard = spawnTile(result);
    setBoard(finalBoard);

    if (pointsGained > 0) {
      setScore((prev) => {
        const next = prev + pointsGained;
        if (next > bestScore) {
          setBestScore(next);
          localStorage.setItem('owg_2048_highscore', String(next));
        }
        return next;
      });
      soundFx(didMerge ? 'merge' : 'slide');
    } else {
      soundFx('slide');
    }

    // Check game over
    if (checkGameOver(finalBoard)) {
      setIsGameOver(true);
      soundFx('over');
    }
  }, [board, isGameOver, hasWon, bestScore, soundFx]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
      }

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          move('UP');
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          move('DOWN');
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          move('LEFT');
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          move('RIGHT');
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [move]);

  // Touch Swipe Handlers
  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e) => {
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (Math.max(absX, absY) > 25) {
      if (absX > absY) {
        move(dx > 0 ? 'RIGHT' : 'LEFT');
      } else {
        move(dy > 0 ? 'DOWN' : 'UP');
      }
    }
  };

  return (
    <div className="cyber2048-container">
      {/* Top Bar with Breadcrumb and Rules Button */}
      <div className="cyber2048-top-bar">
        <nav className="cyber2048-breadcrumb" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span>/</span>
          <Link to="/games">Games</Link>
          <span>/</span>
          <span className="breadcrumb-current">2048 Cyber Grid</span>
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
        gameKey="grid2048"
      />

      {/* Main HUD Banner: Score, Best Score, Sound Toggle & Restart */}
      <div className="cyber2048-hud-banner">
        <div className="hud-player-info">
          <span className="game-avatar-icon">🔢</span>
          <div className="score-stat-group">
            <span className="stat-label">SCORE</span>
            <span className="stat-value neon-cyan">{score}</span>
          </div>
          <div className="score-stat-group">
            <span className="stat-label">BEST</span>
            <span className="stat-value neon-gold">{bestScore}</span>
          </div>
        </div>

        <div className="hud-banner-actions">
          <button
            type="button"
            className={`hud-tool-btn sound-toggle-btn ${!soundEnabled ? 'sound-off' : ''}`}
            onClick={() => setSoundEnabled((prev) => !prev)}
            title="Toggle Sound Effects"
          >
            {soundEnabled ? '🔊 Sound: ON' : '🔈 Sound: OFF'}
          </button>
          <button
            type="button"
            className="hud-tool-btn restart-btn"
            onClick={restartGame}
            title="New Game"
          >
            🔄 Reset
          </button>
        </div>
      </div>

      {/* 4x4 Grid Matrix Shell */}
      <div
        className="cyber2048-grid-shell"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="cyber2048-board">
          {board.map((row, r) =>
            row.map((val, c) => (
              <div
                key={`cell-${r}-${c}`}
                className={`tile-cell ${val > 0 ? `tile-${val}` : 'tile-empty'}`}
              >
                {val > 0 && <span className="tile-value">{val}</span>}
              </div>
            ))
          )}
        </div>

        {/* Win Alert */}
        {hasWon && (
          <div className="win-banner">
            <span>👑 2048 REACHED! You can continue for higher scores!</span>
          </div>
        )}

        {/* Game Over Overlay */}
        {isGameOver && (
          <div className="cyber2048-overlay">
            <div className="game-over-icon">💥</div>
            <h2 className="overlay-title defeat-title">NO MORE MOVES!</h2>
            <p className="overlay-desc">You scored {score} points on the cyber matrix.</p>
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

      {/* Mobile Directional Controls */}
      <div className="mobile-dpad-container" aria-label="Mobile Directional Pad">
        <div className="dpad-row dpad-center">
          <button
            type="button"
            className="dpad-btn dpad-up"
            onClick={() => move('UP')}
            aria-label="Up"
          >
            ▲
          </button>
        </div>
        <div className="dpad-row dpad-middle">
          <button
            type="button"
            className="dpad-btn dpad-left"
            onClick={() => move('LEFT')}
            aria-label="Left"
          >
            ◀
          </button>
          <div className="dpad-hub">🔢</div>
          <button
            type="button"
            className="dpad-btn dpad-right"
            onClick={() => move('RIGHT')}
            aria-label="Right"
          >
            ▶
          </button>
        </div>
        <div className="dpad-row dpad-center">
          <button
            type="button"
            className="dpad-btn dpad-down"
            onClick={() => move('DOWN')}
            aria-label="Down"
          >
            ▼
          </button>
        </div>
      </div>
    </div>
  );
}

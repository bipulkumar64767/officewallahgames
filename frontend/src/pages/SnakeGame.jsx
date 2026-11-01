import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import confetti from 'canvas-confetti';
import GameRulesModal from '../components/GameRulesModal';
import './SnakeGame.css';

const GRID_SIZE = 20;
const INITIAL_SNAKE = [
  { x: 10, y: 10 },
  { x: 10, y: 11 },
  { x: 10, y: 12 },
];
const INITIAL_DIRECTION = { x: 0, y: -1 };
const BASE_SPEED_MS = 140;
const MIN_SPEED_MS = 65;

export default function SnakeGame() {
  const [snake, setSnake] = useState(INITIAL_SNAKE);
  const [direction, setDirection] = useState(INITIAL_DIRECTION);
  const [food, setFood] = useState({ x: 5, y: 5, isGolden: false });
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    return parseInt(localStorage.getItem('owg_snake_highscore') || '0', 10);
  });
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showRulesModal, setShowRulesModal] = useState(false);

  const canvasRef = useRef(null);
  const directionRef = useRef(direction);
  const nextDirectionRef = useRef(direction);
  const gameLoopRef = useRef(null);
  const touchStartRef = useRef({ x: 0, y: 0 });

  directionRef.current = direction;

  // Sound synthesis via Web Audio API
  const playSound = useCallback((type) => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      if (type === 'eat') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (type === 'golden') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(587.33, now);
        osc.frequency.setValueAtTime(880, now + 0.08);
        osc.frequency.setValueAtTime(1174.66, now + 0.16);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc.start(now);
        osc.stop(now + 0.28);
      } else if (type === 'turn') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, now);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        osc.start(now);
        osc.stop(now + 0.04);
      } else if (type === 'over') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.exponentialRampToValueAtTime(65, now + 0.45);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.start(now);
        osc.stop(now + 0.45);
      }
    } catch {
      // Audio autoplay policy fallback
    }
  }, [soundEnabled]);

  // Generate random food not colliding with snake
  const generateFood = useCallback((currentSnake) => {
    let newX, newY, collision;
    do {
      newX = Math.floor(Math.random() * GRID_SIZE);
      newY = Math.floor(Math.random() * GRID_SIZE);
      collision = currentSnake.some((seg) => seg.x === newX && seg.y === newY);
    } while (collision);

    const isGolden = Math.random() < 0.2; // 20% chance of golden energy orb
    return { x: newX, y: newY, isGolden };
  }, []);

  // Start new run
  const handleStartGame = () => {
    setSnake(INITIAL_SNAKE);
    setDirection(INITIAL_DIRECTION);
    directionRef.current = INITIAL_DIRECTION;
    nextDirectionRef.current = INITIAL_DIRECTION;
    setScore(0);
    setIsGameOver(false);
    setIsPaused(false);
    setIsNewHighScore(false);
    setIsPlaying(true);
    setFood(generateFood(INITIAL_SNAKE));
    playSound('turn');
  };

  // Turn direction with 180-degree reversal prevention
  const changeDirection = useCallback((newDir) => {
    const cur = directionRef.current;
    // Disallow exact reverse
    if (newDir.x + cur.x === 0 && newDir.y + cur.y === 0) return;
    nextDirectionRef.current = newDir;
    playSound('turn');
  }, [playSound]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      if (e.key === ' ' || e.key.toLowerCase() === 'p') {
        if (isPlaying && !isGameOver) {
          setIsPaused((prev) => !prev);
        }
        return;
      }

      if (!isPlaying || isPaused || isGameOver) return;

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          changeDirection({ x: 0, y: -1 });
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          changeDirection({ x: 0, y: 1 });
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          changeDirection({ x: -1, y: 0 });
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          changeDirection({ x: 1, y: 0 });
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isPaused, isGameOver, changeDirection]);

  // Core Game Loop
  useEffect(() => {
    if (!isPlaying || isPaused || isGameOver) return;

    // Calculate speed based on score (faster as snake eats)
    const currentSpeed = Math.max(MIN_SPEED_MS, BASE_SPEED_MS - Math.floor(score / 50) * 8);

    gameLoopRef.current = setTimeout(() => {
      setSnake((prevSnake) => {
        const curDir = nextDirectionRef.current;
        directionRef.current = curDir;
        setDirection(curDir);

        const head = prevSnake[0];
        const newHead = {
          x: head.x + curDir.x,
          y: head.y + curDir.y,
        };

        // Wall Collision Check
        if (
          newHead.x < 0 ||
          newHead.x >= GRID_SIZE ||
          newHead.y < 0 ||
          newHead.y >= GRID_SIZE
        ) {
          handleGameOverAction();
          return prevSnake;
        }

        // Tail Self-Collision Check
        if (prevSnake.some((seg) => seg.x === newHead.x && seg.y === newHead.y)) {
          handleGameOverAction();
          return prevSnake;
        }

        const newSnake = [newHead, ...prevSnake];

        // Food Check
        if (newHead.x === food.x && newHead.y === food.y) {
          const pointsAwarded = food.isGolden ? 50 : 10;
          setScore((prevScore) => {
            const nextScore = prevScore + pointsAwarded;
            if (nextScore > highScore) {
              setHighScore(nextScore);
              localStorage.setItem('owg_snake_highscore', String(nextScore));
              setIsNewHighScore(true);
            }
            return nextScore;
          });

          if (food.isGolden) {
            playSound('golden');
            try {
              confetti({ particleCount: 35, spread: 60, origin: { y: 0.6 } });
            } catch (_) {}
          } else {
            playSound('eat');
          }

          setFood(generateFood(newSnake));
        } else {
          newSnake.pop(); // Remove tail segment
        }

        return newSnake;
      });
    }, currentSpeed);

    return () => clearTimeout(gameLoopRef.current);
  });

  const handleGameOverAction = () => {
    setIsGameOver(true);
    setIsPlaying(false);
    playSound('over');
  };

  // Canvas Neon Renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const cellSize = width / GRID_SIZE;

    // Clear background
    ctx.fillStyle = '#080c18';
    ctx.fillRect(0, 0, width, height);

    // Subtle grid lines
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellSize, 0);
      ctx.lineTo(i * cellSize, height);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i * cellSize);
      ctx.lineTo(width, i * cellSize);
      ctx.stroke();
    }

    // Draw Food Orb
    const foodCenterX = food.x * cellSize + cellSize / 2;
    const foodCenterY = food.y * cellSize + cellSize / 2;
    const foodRadius = cellSize * 0.38;

    ctx.save();
    ctx.shadowBlur = food.isGolden ? 18 : 12;
    ctx.shadowColor = food.isGolden ? '#ffd700' : '#ff007f';
    ctx.fillStyle = food.isGolden ? '#ffd700' : '#ff007f';
    ctx.beginPath();
    ctx.arc(foodCenterX, foodCenterY, foodRadius, 0, Math.PI * 2);
    ctx.fill();

    // Food inner core shine
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(foodCenterX - 1.5, foodCenterY - 1.5, foodRadius * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Draw Snake Segments
    snake.forEach((seg, idx) => {
      const isHead = idx === 0;
      const x = seg.x * cellSize + 1.5;
      const y = seg.y * cellSize + 1.5;
      const size = cellSize - 3;

      ctx.save();
      if (isHead) {
        ctx.shadowBlur = 14;
        ctx.shadowColor = '#00ffaa';
        ctx.fillStyle = '#00ffaa';
      } else {
        const alpha = Math.max(0.4, 1 - idx / snake.length);
        ctx.shadowBlur = 6;
        ctx.shadowColor = '#00f2fe';
        ctx.fillStyle = `rgba(0, 242, 254, ${alpha})`;
      }

      ctx.beginPath();
      ctx.roundRect(x, y, size, size, isHead ? 6 : 4);
      ctx.fill();

      // Head Eyes
      if (isHead) {
        ctx.fillStyle = '#0a0e1c';
        const eyeSize = size * 0.18;
        const curD = directionRef.current;
        let eye1 = { x: x + size * 0.25, y: y + size * 0.25 };
        let eye2 = { x: x + size * 0.75, y: y + size * 0.25 };

        if (curD.x === 1) {
          eye1 = { x: x + size * 0.7, y: y + size * 0.25 };
          eye2 = { x: x + size * 0.7, y: y + size * 0.75 };
        } else if (curD.x === -1) {
          eye1 = { x: x + size * 0.3, y: y + size * 0.25 };
          eye2 = { x: x + size * 0.3, y: y + size * 0.75 };
        } else if (curD.y === 1) {
          eye1 = { x: x + size * 0.25, y: y + size * 0.7 };
          eye2 = { x: x + size * 0.75, y: y + size * 0.7 };
        }

        ctx.beginPath();
        ctx.arc(eye1.x, eye1.y, eyeSize, 0, Math.PI * 2);
        ctx.arc(eye2.x, eye2.y, eyeSize, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    });
  }, [snake, food]);

  // Touch Swipe Handlers for Mobile Canvas
  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e) => {
    if (!isPlaying || isPaused || isGameOver) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (Math.max(absX, absY) > 25) {
      if (absX > absY) {
        changeDirection(dx > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 });
      } else {
        changeDirection(dy > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 });
      }
    }
  };

  return (
    <div className="snake-page-container">
      {/* Top Header Bar with Breadcrumb and Rules Button */}
      <div className="snake-top-bar">
        <nav className="snake-breadcrumb" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span>/</span>
          <Link to="/games">Games</Link>
          <span>/</span>
          <span className="breadcrumb-current">Snake Rush</span>
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
        gameKey="snake"
      />

      {/* Main HUD Banner: Score, High Score, Sound & Mic/Controls */}
      <div className="snake-hud-banner">
        <div className="hud-player-info">
          <span className="snake-avatar-icon">🐍</span>
          <div className="score-stat-group">
            <span className="stat-label">SCORE</span>
            <span className="stat-value neon-cyan">{score}</span>
          </div>
          <div className="score-stat-group">
            <span className="stat-label">BEST</span>
            <span className="stat-value neon-gold">{highScore}</span>
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

          {isPlaying && (
            <button
              type="button"
              className="hud-tool-btn pause-btn"
              onClick={() => setIsPaused((prev) => !prev)}
              title="Pause/Resume Game"
            >
              {isPaused ? '▶️ Resume' : '⏸️ Pause'}
            </button>
          )}
        </div>
      </div>

      {/* Game Arena Outer Container */}
      <div className="snake-arena-wrapper">
        <div className="canvas-frame">
          <canvas
            ref={canvasRef}
            width={440}
            height={440}
            className="snake-canvas"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          />

          {/* Start Screen Overlay */}
          {!isPlaying && !isGameOver && (
            <div className="snake-overlay-card">
              <div className="snake-overlay-badge">ARCADE CLASSIC</div>
              <h2 className="snake-overlay-title">SNAKE RUSH</h2>
              <p className="snake-overlay-desc">
                Eat neon orbs to grow longer and accelerate. Avoid crashing into walls or your tail!
              </p>
              <button
                type="button"
                className="btn-cyber-primary"
                onClick={handleStartGame}
                autoFocus
              >
                🚀 Start Game
              </button>
              <div className="overlay-controls-hint">
                <span>⌨️ Arrow Keys / WASD</span>
                <span>•</span>
                <span>📱 Touch / D-Pad</span>
              </div>
            </div>
          )}

          {/* Pause Screen Overlay */}
          {isPlaying && isPaused && (
            <div className="snake-overlay-card">
              <h2 className="snake-overlay-title">GAME PAUSED</h2>
              <p className="snake-overlay-desc">Take a breather! Click below or press Space to continue.</p>
              <button
                type="button"
                className="btn-cyber-primary"
                onClick={() => setIsPaused(false)}
              >
                ▶️ Resume Match
              </button>
            </div>
          )}

          {/* Game Over Overlay */}
          {isGameOver && (
            <div className="snake-overlay-card game-over-card">
              <div className="game-over-icon">💥</div>
              <h2 className="snake-overlay-title defeat-title">GAME OVER</h2>
              {isNewHighScore && (
                <div className="new-record-pill">
                  🏆 NEW PERSONAL BEST!
                </div>
              )}
              <div className="game-over-stats">
                <div className="go-stat-box">
                  <span className="go-stat-label">Final Score</span>
                  <span className="go-stat-val neon-cyan">{score}</span>
                </div>
                <div className="go-stat-box">
                  <span className="go-stat-label">High Score</span>
                  <span className="go-stat-val neon-gold">{highScore}</span>
                </div>
              </div>
              <div className="game-over-actions">
                <button
                  type="button"
                  className="btn-cyber-primary"
                  onClick={handleStartGame}
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

        {/* Mobile On-Screen D-Pad Controls */}
        <div className="mobile-dpad-container" aria-label="Mobile Directional Pad">
          <div className="dpad-row dpad-center">
            <button
              type="button"
              className="dpad-btn dpad-up"
              onClick={() => changeDirection({ x: 0, y: -1 })}
              aria-label="Up"
            >
              ▲
            </button>
          </div>
          <div className="dpad-row dpad-middle">
            <button
              type="button"
              className="dpad-btn dpad-left"
              onClick={() => changeDirection({ x: -1, y: 0 })}
              aria-label="Left"
            >
              ◀
            </button>
            <div className="dpad-hub">🐍</div>
            <button
              type="button"
              className="dpad-btn dpad-right"
              onClick={() => changeDirection({ x: 1, y: 0 })}
              aria-label="Right"
            >
              ▶
            </button>
          </div>
          <div className="dpad-row dpad-center">
            <button
              type="button"
              className="dpad-btn dpad-down"
              onClick={() => changeDirection({ x: 0, y: 1 })}
              aria-label="Down"
            >
              ▼
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

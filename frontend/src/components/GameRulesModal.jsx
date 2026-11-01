import React, { useEffect } from 'react';
import './GameRulesModal.css';

const RULES_DATA = {
  tictactoe: {
    title: 'Tic-Tac-Toe Arena',
    badge: 'Classic 1v1 PvP',
    rules: [
      {
        icon: '🎯',
        heading: 'Winning Condition',
        desc: 'Place 3 of your marks (X or O) in an unbroken line horizontally, vertically, or diagonally to win.',
      },
      {
        icon: '⏱️',
        heading: '30-Second Turn Timer',
        desc: 'Each turn has a 30s countdown. If your timer runs out, your turn automatically passes to your opponent.',
      },
      {
        icon: '⚡',
        heading: 'First Move Advantage',
        desc: 'Player X (Host) always takes the first move in a round. Alternate turns in rematch rounds.',
      },
      {
        icon: '🎙️',
        heading: 'Real-Time Voice Chat',
        desc: 'Join the in-room voice chat at any time. You can mute your microphone or deafen audio whenever needed.',
      },
      {
        icon: '🔄',
        heading: 'Instant Rematch',
        desc: 'When a game ends, either player can propose a rematch to battle again on a fresh grid.',
      },
    ],
  },
  ludo: {
    title: 'Ludo Royale',
    badge: '2-4 Player Board Race',
    rules: [
      {
        icon: '🎲',
        heading: 'Unlocking Pawns with 6',
        desc: 'You must roll a 6 on the dice to move a pawn out of your Yard and onto the starting square.',
      },
      {
        icon: '✨',
        heading: 'Extra Roll Mechanics',
        desc: 'Rolling a 6 grants an extra turn. Rolling three consecutive 6s forfeits the third roll.',
      },
      {
        icon: '⚔️',
        heading: 'Pawn Captures',
        desc: 'Landing on an opponent’s pawn sends it back to their Yard and awards you an immediate bonus roll.',
      },
      {
        icon: '🛡️',
        heading: 'Safe Zones & Stars',
        desc: 'Squares marked with a Star (★) and your colored Home Stretch track are safe zones where pawns cannot be captured.',
      },
      {
        icon: '🏆',
        heading: 'Winning the Match',
        desc: 'The first player to guide all 4 pawns safely into the Home triangle wins the game!',
      },
    ],
  },
  wordgrid: {
    title: 'Word Grid Blitz',
    badge: 'Fast Boggle-Style Puzzle',
    rules: [
      {
        icon: '🔤',
        heading: 'Form Valid Words',
        desc: 'Connect adjacent letters horizontally, vertically, or diagonally to form valid English dictionary words.',
      },
      {
        icon: '📈',
        heading: 'Word Length Scoring',
        desc: '3 letters = 1 pt, 4 letters = 2 pts, 5 letters = 4 pts, 6+ letters = 8+ pts. Longer words win the round!',
      },
      {
        icon: '⏳',
        heading: 'Timed Sprint',
        desc: 'Race against the clock before the round timer expires. The player with the highest total score wins.',
      },
      {
        icon: '🚫',
        heading: 'No Duplicate Submissions',
        desc: 'Each valid word can only be submitted once per round.',
      },
    ],
  },
  connectdrop: {
    title: 'Connect Drop 4',
    badge: 'Vertical Strategy PvP',
    rules: [
      {
        icon: '🔴',
        heading: 'Connect 4 to Win',
        desc: 'Be the first player to form a continuous line of 4 discs of your color (horizontal, vertical, or diagonal).',
      },
      {
        icon: '⬇️',
        heading: 'Gravity-Fed Drops',
        desc: 'Click or tap any column; your disc will drop to the lowest available unoccupied slot in that column.',
      },
      {
        icon: '⏱️',
        heading: 'Turn Time Limit',
        desc: 'Players alternate turns with a 30s countdown. Keep your opponent from establishing four-in-a-row!',
      },
      {
        icon: '🤝',
        heading: 'Draw Condition',
        desc: 'If the entire 7x6 board fills without any 4-in-a-row connection, the match concludes as a draw.',
      },
    ],
  },
  snake: {
    title: 'Snake Rush',
    badge: 'Retro Arcade Solo',
    rules: [
      {
        icon: '🐍',
        heading: 'Navigate the Grid',
        desc: 'Guide your cyber snake across the arena using Arrow keys or WASD on desktop, or the on-screen D-pad on mobile.',
      },
      {
        icon: '⚡',
        heading: 'Eat Neon Energy Orbs',
        desc: 'Collect neon food (+10 pts) to grow longer. Golden power orbs spawn intermittently for bonus score (+50 pts).',
      },
      {
        icon: '💥',
        heading: 'Avoid Collisions',
        desc: 'Crashing into arena walls or your own tail will cause an instant game over. Plan your turns carefully!',
      },
      {
        icon: '🏆',
        heading: 'High Score Mastery',
        desc: 'Speed increases as your snake grows. Outmaneuver your past records to set new personal bests saved in your browser.',
      },
    ],
  },
  grid2048: {
    title: '2048 Cyber Grid',
    badge: 'Number Puzzle Solo',
    rules: [
      {
        icon: '🔢',
        heading: 'Slide & Merge',
        desc: 'Use Arrow keys, WASD, or swipe gestures to slide tiles across the 4x4 grid. When two tiles with the same number collide, they merge into one!',
      },
      {
        icon: '✨',
        heading: 'Tile Evolution',
        desc: '2 + 2 = 4, 4 + 4 = 8 ... combine tiles all the way up to 2048 and beyond for astronomical high scores.',
      },
      {
        icon: '🧱',
        heading: 'Keep Space Open',
        desc: 'A new 2 or 4 tile spawns after every valid slide. If the board completely fills and no moves remain, the run ends.',
      },
      {
        icon: '👑',
        heading: 'Victory Condition',
        desc: 'Create the legendary 2048 tile to win! You can continue playing indefinitely to achieve the highest possible score.',
      },
    ],
  },
  speedchess: {
    title: 'Speed Chess Arena',
    badge: 'Real-Time 1v1 Strategy',
    rules: [
      {
        icon: '♟️',
        heading: 'Standard Chess Rules',
        desc: 'Full FIDE chess rules apply: pawns, knights, bishops, rooks, queens, and kings move according to standard regulations.',
      },
      {
        icon: '⏱️',
        heading: '5-Minute Blitz Clocks',
        desc: 'Each player has a 5-minute countdown clock. Make your moves before your clock reaches zero or your opponent claims victory on time.',
      },
      {
        icon: '⚔️',
        heading: 'Check & Checkmate',
        desc: 'Trap your opponent’s King with an inescapable attack to win by Checkmate.',
      },
      {
        icon: '🎙️',
        heading: 'Voice & Pairing Options',
        desc: 'Play vs Smart Stockfish-style AI or challenge coworkers via Private Room codes with real-time in-room voice chat.',
      },
    ],
  },
};

export default function GameRulesModal({ isOpen, onClose, gameKey = 'tictactoe' }) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const data = RULES_DATA[gameKey] || RULES_DATA.tictactoe;

  return (
    <div className="rules-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="rules-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="rules-modal-header">
          <div className="rules-header-title-box">
            <span className="rules-header-badge">{data.badge}</span>
            <h3 className="rules-modal-title">ℹ️ {data.title} — Rules & Regulations</h3>
          </div>
          <button
            type="button"
            className="rules-close-btn"
            onClick={onClose}
            aria-label="Close Rules"
          >
            ✕
          </button>
        </div>

        <div className="rules-modal-body">
          <ul className="rules-list">
            {data.rules.map((rule, idx) => (
              <li key={idx} className="rule-item">
                <span className="rule-icon">{rule.icon}</span>
                <div className="rule-content">
                  <h4 className="rule-heading">{rule.heading}</h4>
                  <p className="rule-desc">{rule.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rules-modal-footer">
          <button type="button" className="rules-got-it-btn" onClick={onClose}>
            ✓ Got It, Let's Play!
          </button>
        </div>
      </div>
    </div>
  );
}

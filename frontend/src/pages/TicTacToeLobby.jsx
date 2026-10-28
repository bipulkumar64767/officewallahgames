import { Link } from 'react-router-dom';
import './TicTacToeLobby.css';

const TicTacToeLobby = () => {
  return (
    <div className="tictactoe-lobby-container">
      <nav className="lobby-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        <Link to="/games">Games</Link>
        <span>/</span>
        <span style={{ color: '#fff' }}>Tic-Tac-Toe Arena</span>
      </nav>

      <div className="lobby-hero">
        <div className="lobby-hero-badge">
          <span>⚔️</span> Multiplayer PvP Live
        </div>
        <h1 className="lobby-title">Tic-Tac-Toe Arena</h1>
        <p className="lobby-subtitle">
          Real-time 1v1 PvP showdowns with sub-50ms WebSocket synchronization.
        </p>

        <div className="lobby-preview-box">
          <span className="lobby-status-tag">⚡ PRD 03 Game Lobby Ready</span>

          <div className="lobby-preview-grid">
            <div className="lobby-grid-cell" style={{ color: '#00ffaa' }}>X</div>
            <div className="lobby-grid-cell" style={{ color: '#ff007f' }}>O</div>
            <div className="lobby-grid-cell" style={{ color: '#00ffaa' }}>X</div>
            <div className="lobby-grid-cell"></div>
            <div className="lobby-grid-cell" style={{ color: '#00ffaa' }}>X</div>
            <div className="lobby-grid-cell"></div>
            <div className="lobby-grid-cell" style={{ color: '#ff007f' }}>O</div>
            <div className="lobby-grid-cell"></div>
            <div className="lobby-grid-cell" style={{ color: '#00ffaa' }}>X</div>
          </div>

          <p style={{ color: '#a0aec0', fontSize: '0.9rem', margin: 0 }}>
            Lobby &amp; matchmaking engine connects here via STOMP / WebSocket (Port 8083).
          </p>
        </div>
      </div>
    </div>
  );
};

export default TicTacToeLobby;

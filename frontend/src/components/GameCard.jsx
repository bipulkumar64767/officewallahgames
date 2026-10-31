import { Link } from 'react-router-dom';
import './GameCard.css';

const defaultIcons = {
  tictactoe: '❌⭕',
  ludo: '🎲',
  wordgrid: '🔤',
  connectdrop: '🔴🟡',
  snake: '🐍',
  chess: '♟️',
  game2048: '🔢',
  minesweeper: '💣',
  connect4: '🔴🟡',
};

const GameCard = ({ game }) => {
  const {
    gameId,
    name,
    tagline,
    gameMode,
    route,
    minPlayers,
    maxPlayers,
    thumbnailUrl,
    icon,
  } = game;

  const isActive = Boolean(game.isActive ?? game.active);
  const isMaintenance = Boolean(game.isMaintenance ?? game.maintenance);

  const displayIcon = icon || defaultIcons[gameId] || (gameMode === 'MULTIPLAYER' ? '⚔️' : '🕹️');

  const getStatusBadge = () => {
    if (isMaintenance) {
      return (
        <span className="game-badge badge-maintenance">
          Maintenance
        </span>
      );
    }
    if (isActive) {
      return (
        <span className="game-badge badge-live">
          <span className="pulse-dot" /> LIVE
        </span>
      );
    }
    return (
      <span className="game-badge badge-soon">
        Coming Soon
      </span>
    );
  };

  const isLive = isActive && !isMaintenance;

  const getPlayerTag = () => {
    if (gameMode === 'SINGLE_PLAYER' || maxPlayers === 1) {
      return '1 Player • Solo';
    }
    const min = minPlayers || 2;
    const max = maxPlayers || min;
    if (min === 2 && max === 2) {
      return '1v1 Duel • PvP';
    }
    return `${min}–${max} Players (NvN) • PvP`;
  };

  const playerTag = getPlayerTag();

  return (
    <div className={`game-card ${isLive ? 'live-card' : ''}`}>
      <div className="game-card-header">
        <div className="game-card-icon-wrap">
          {thumbnailUrl ? (
            <img src={thumbnailUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          ) : (
            <span>{displayIcon}</span>
          )}
        </div>
        {getStatusBadge()}
      </div>

      <div className="game-card-body">
        <h3 className="game-card-title">{name}</h3>
        <p className="game-card-tagline">{tagline}</p>
        <div className="game-card-meta">
          <span className="meta-tag">{playerTag}</span>
          <span className="meta-tag">{game.category?.replace('_', ' ') || 'CASUAL'}</span>
        </div>
      </div>

      <div className="game-card-action">
        {isLive ? (
          <Link to={route || `/games/${gameId}`} className="btn-play btn-play-live">
            Play Now ▶
          </Link>
        ) : (
          <button className="btn-play btn-play-disabled" disabled>
            {isMaintenance ? 'Under Maintenance' : 'Coming Soon'}
          </button>
        )}
      </div>
    </div>
  );
};

export default GameCard;

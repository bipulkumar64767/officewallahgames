import './GameModeSelector.css';

const GameModeSelector = ({ selectedMode, onSelectMode, games = [] }) => {
  const multiplayerCount = games.filter((g) => g.gameMode === 'MULTIPLAYER').length;
  const singleplayerCount = games.filter((g) => g.gameMode === 'SINGLE_PLAYER').length;
  const multiplayerLive = games.filter((g) => g.gameMode === 'MULTIPLAYER' && g.isActive && !g.isMaintenance).length;

  return (
    <div className="mode-selector-container">
      <div className="mode-cards-grid">
        {/* Multiplayer Arena Card */}
        <div
          className={`mode-card ${selectedMode === 'MULTIPLAYER' ? 'active-multiplayer' : ''}`}
          onClick={() => onSelectMode(selectedMode === 'MULTIPLAYER' ? 'ALL' : 'MULTIPLAYER')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              onSelectMode(selectedMode === 'MULTIPLAYER' ? 'ALL' : 'MULTIPLAYER');
            }
          }}
        >
          <div className="mode-icon">⚔️</div>
          <div className="mode-details">
            <div className="mode-header">
              <h3 className="mode-title">Multiplayer Arena</h3>
              <span className="mode-badge">
                {multiplayerLive > 0 ? `🟢 ${multiplayerLive} Live` : `${multiplayerCount} Games`}
              </span>
            </div>
            <p className="mode-tagline">Real-time 1v1 PvP &amp; dual player matches</p>
          </div>
        </div>

        {/* Single Player Hub Card */}
        <div
          className={`mode-card ${selectedMode === 'SINGLE_PLAYER' ? 'active-singleplayer' : ''}`}
          onClick={() => onSelectMode(selectedMode === 'SINGLE_PLAYER' ? 'ALL' : 'SINGLE_PLAYER')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              onSelectMode(selectedMode === 'SINGLE_PLAYER' ? 'ALL' : 'SINGLE_PLAYER');
            }
          }}
        >
          <div className="mode-icon">🕹️</div>
          <div className="mode-details">
            <div className="mode-header">
              <h3 className="mode-title">Single Player Hub</h3>
              <span className="mode-badge">{singleplayerCount} Games</span>
            </div>
            <p className="mode-tagline">Solo high-score challenges &amp; arcade classics</p>
          </div>
        </div>
      </div>

      {/* All Games Pill */}
      <div className="mode-all-filter">
        <button
          className={`btn-all-filter ${selectedMode === 'ALL' ? 'active-all' : ''}`}
          onClick={() => onSelectMode('ALL')}
        >
          🎲 View All Games ({games.length})
        </button>
      </div>
    </div>
  );
};

export default GameModeSelector;

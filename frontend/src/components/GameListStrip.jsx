import { useRef } from 'react';
import GameCard from './GameCard';
import './GameListStrip.css';

const GameListStrip = ({ games = [], selectedMode = 'ALL' }) => {
  const scrollRef = useRef(null);

  const filteredGames = games
    .filter((g) => {
      if (selectedMode === 'ALL') return true;
      if (selectedMode === 'SINGLE_PLAYER') {
        return (
          g.gameMode === 'SINGLE_PLAYER' ||
          ['tictactoe', 'ludo', 'wordgrid', 'connectdrop'].includes(g.gameId)
        );
      }
      return g.gameMode === selectedMode;
    })
    .sort((a, b) => (a.displayOrder || 99) - (b.displayOrder || 99));

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -340 : 340;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const getSectionTitle = () => {
    if (selectedMode === 'MULTIPLAYER') return '⚔️ Multiplayer Arena';
    if (selectedMode === 'SINGLE_PLAYER') return '🕹️ Single Player Hub';
    return '🚀 Game Catalog';
  };

  return (
    <section className="game-strip-section">
      <div className="strip-header">
        <div className="strip-title-wrap">
          <h2 className="strip-title">{getSectionTitle()}</h2>
          <span className="strip-count">({filteredGames.length} available)</span>
        </div>
        {filteredGames.length > 2 && (
          <div className="strip-controls">
            <button
              className="strip-nav-btn"
              onClick={() => scroll('left')}
              title="Scroll left"
              aria-label="Scroll left"
            >
              ◀
            </button>
            <button
              className="strip-nav-btn"
              onClick={() => scroll('right')}
              title="Scroll right"
              aria-label="Scroll right"
            >
              ▶
            </button>
          </div>
        )}
      </div>

      {filteredGames.length === 0 ? (
        <div className="strip-empty">
          <p>No games found matching the selected filter.</p>
        </div>
      ) : (
        <div className="strip-scroll-container" ref={scrollRef}>
          {filteredGames.map((game) => (
            <GameCard key={game.gameId} game={game} />
          ))}
        </div>
      )}
    </section>
  );
};

export default GameListStrip;

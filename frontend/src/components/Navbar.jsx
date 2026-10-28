import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

const Navbar = () => {
  const { user, logout, setIsLoginModalOpen } = useAuth();

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <Link to="/" className="navbar-brand">
          🎮 OfficeWallahGames
        </Link>
        <div className="navbar-links">
          <Link to="/">Home</Link>
          <Link to="/games">Games</Link>
        </div>
      </div>

      <div className="navbar-right">
        <div className="online-counter" title="Active players across arena">
          <span className="online-indicator">🟢</span>
          <span className="online-text">1,420 Online</span>
        </div>

        {user && (
          <div className="user-profile-pill">
            {user.isGuest ? (
              <>
                <span className="user-identity guest" title={user.userId}>
                  👤 {user.userId}
                </span>
                <button
                  type="button"
                  className="auth-btn login-btn"
                  onClick={() => setIsLoginModalOpen(true)}
                >
                  Login
                </button>
              </>
            ) : (
              <>
                <span className="user-identity member" title={user.displayName}>
                  ⭐ {user.displayName}
                </span>
                <button
                  type="button"
                  className="auth-btn logout-btn"
                  onClick={logout}
                >
                  Logout
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;

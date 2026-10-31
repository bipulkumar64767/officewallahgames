import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import './LoginModal.css';

const LoginModal = () => {
  const { isLoginModalOpen, setIsLoginModalOpen, user, login, register, updateDisplayName } = useAuth();
  const [tab, setTab] = useState('GUEST'); // 'GUEST' | 'LOGIN' | 'REGISTER'
  const [guestName, setGuestName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [regDisplayName, setRegDisplayName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user?.displayName && !user.displayName.startsWith('GUEST_')) {
      setGuestName(user.displayName);
    }
  }, [user]);

  const handleClose = useCallback(() => {
    setError('');
    setIsLoginModalOpen(false);
  }, [setIsLoginModalOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isLoginModalOpen) {
        handleClose();
      }
    };

    if (isLoginModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isLoginModalOpen, handleClose]);

  if (!isLoginModalOpen) {
    return null;
  }

  const handleGuestSubmit = (e) => {
    e.preventDefault();
    if (!guestName.trim()) {
      setError('Please enter a display name for playing');
      return;
    }
    updateDisplayName(guestName.trim());
    handleClose();
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Please enter your username');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await login(username.trim(), password);
      setUsername('');
      setPassword('');
      handleClose();
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Please choose a username');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await register(username.trim(), password, regDisplayName || username.trim());
      setUsername('');
      setPassword('');
      setRegDisplayName('');
      handleClose();
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  return (
    <div
      className="login-modal-overlay"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
    >
      <div className="login-modal-card">
        <button
          type="button"
          className="login-modal-close"
          onClick={handleClose}
          aria-label="Close modal"
        >
          ✕
        </button>

        <div className="login-modal-header">
          <div className="modal-icon-badge">🎮</div>
          <h2 id="login-modal-title" className="login-modal-title">
            PLAYER ACCESS
          </h2>
          <p className="login-modal-subtitle">
            Play instantly as Guest or Sign In / Register to sync rankings &amp; stats
          </p>

          <div className="modal-tab-selector">
            <button
              type="button"
              className={`modal-tab-btn ${tab === 'GUEST' ? 'active' : ''}`}
              onClick={() => { setTab('GUEST'); setError(''); }}
            >
              🎮 Guest Play
            </button>
            <button
              type="button"
              className={`modal-tab-btn ${tab === 'LOGIN' ? 'active' : ''}`}
              onClick={() => { setTab('LOGIN'); setError(''); }}
            >
              🔑 Sign In
            </button>
            <button
              type="button"
              className={`modal-tab-btn ${tab === 'REGISTER' ? 'active' : ''}`}
              onClick={() => { setTab('REGISTER'); setError(''); }}
            >
              ✨ Register
            </button>
          </div>
        </div>

        {error && <div className="login-modal-error">{error}</div>}

        {/* Tab 1: Guest Play */}
        {tab === 'GUEST' && (
          <form onSubmit={handleGuestSubmit} className="login-modal-form">
            <div className="form-group">
              <label htmlFor="modal-guest-name">Your Player Name / Alias</label>
              <input
                id="modal-guest-name"
                type="text"
                placeholder="e.g. Rahul, CyberNinja, ApexGamer"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                autoFocus
                maxLength={20}
              />
              <span className="form-hint">
                This name is displayed to friends in Ludo, Tic-Tac-Toe, Word Grid &amp; Connect Drop!
              </span>
            </div>

            <div className="login-modal-actions">
              <button type="submit" className="btn-login-submit">
                ⚡ Save Name &amp; Play Instantly
              </button>
              <button
                type="button"
                className="btn-continue-guest"
                onClick={handleClose}
              >
                Skip &amp; Keep Random ID
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Sign In */}
        {tab === 'LOGIN' && (
          <form onSubmit={handleLoginSubmit} className="login-modal-form">
            <div className="form-group">
              <label htmlFor="modal-username">Username</label>
              <input
                id="modal-username"
                type="text"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                disabled={isSubmitting}
                autoComplete="username"
              />
            </div>

            <div className="form-group">
              <label htmlFor="modal-password">Password / PIN</label>
              <input
                id="modal-password"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                autoComplete="current-password"
              />
            </div>

            <div className="login-modal-actions">
              <button
                type="submit"
                className="btn-login-submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Authenticating...' : '🔑 Sign In'}
              </button>
            </div>
          </form>
        )}

        {/* Tab 3: Register */}
        {tab === 'REGISTER' && (
          <form onSubmit={handleRegisterSubmit} className="login-modal-form">
            <div className="form-group">
              <label htmlFor="modal-reg-username">Username</label>
              <input
                id="modal-reg-username"
                type="text"
                placeholder="Choose a username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                disabled={isSubmitting}
                autoComplete="username"
              />
            </div>

            <div className="form-group">
              <label htmlFor="modal-reg-display">Display Name (In-Game)</label>
              <input
                id="modal-reg-display"
                type="text"
                placeholder="e.g. MasterStrategist"
                value={regDisplayName}
                onChange={(e) => setRegDisplayName(e.target.value)}
                disabled={isSubmitting}
                maxLength={20}
              />
            </div>

            <div className="form-group">
              <label htmlFor="modal-reg-password">Password</label>
              <input
                id="modal-reg-password"
                type="password"
                placeholder="Choose password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                autoComplete="new-password"
              />
            </div>

            <div className="login-modal-actions">
              <button
                type="submit"
                className="btn-login-submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Creating account...' : '✨ Create Account &amp; Play'}
              </button>
            </div>
          </form>
        )}

        <div className="login-modal-note">
          <span className="note-badge">MULTI-TIER ACCESS</span>
          <p>
            No credit card or download required. Instant browser play!
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;

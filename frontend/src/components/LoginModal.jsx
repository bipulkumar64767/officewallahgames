import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import './LoginModal.css';

const LoginModal = () => {
  const { isLoginModalOpen, setIsLoginModalOpen, login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Please enter a username or player alias');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await login(username.trim(), password);
      setUsername('');
      setPassword('');
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
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
          <div className="modal-icon-badge">⚡</div>
          <h2 id="login-modal-title" className="login-modal-title">
            PLAYER ACCESS
          </h2>
          <p className="login-modal-subtitle">
            Sign in to keep stats, sync games & dominate leaderboards
          </p>
        </div>

        <form onSubmit={handleSubmit} className="login-modal-form">
          {error && <div className="login-modal-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="modal-username">Player Alias / Username</label>
            <input
              id="modal-username"
              type="text"
              placeholder="e.g. CyberNinja, alex_boss"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              disabled={isSubmitting}
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="modal-password">Passcode / PIN</label>
            <input
              id="modal-password"
              type="password"
              placeholder="Enter any password"
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
              {isSubmitting ? 'Authenticating...' : '⚡ Login to Play'}
            </button>

            <button
              type="button"
              className="btn-continue-guest"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Continue as Guest
            </button>
          </div>
        </form>

        <div className="login-modal-note">
          <span className="note-badge">PROTOTYPE MODE</span>
          <p>
            Quick mock login active — any username &amp; password will grant access!
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;

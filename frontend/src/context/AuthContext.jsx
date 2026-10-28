/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { authApi } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('owg_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.userId) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to parse user from localStorage', e);
    }
    return null;
  });

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      let isMounted = true;
      authApi.createGuestSession().then((guestProfile) => {
        if (isMounted) {
          setUser(guestProfile);
          localStorage.setItem('owg_user', JSON.stringify(guestProfile));
        }
      });
      return () => {
        isMounted = false;
      };
    }
  }, [user]);

  const login = useCallback(async (username, password) => {
    const profile = await authApi.login(username, password);
    setUser(profile);
    localStorage.setItem('owg_user', JSON.stringify(profile));
    setIsLoginModalOpen(false);
    return profile;
  }, []);

  const logout = useCallback(async () => {
    localStorage.removeItem('owg_user');
    const guestProfile = await authApi.createGuestSession();
    setUser(guestProfile);
    localStorage.setItem('owg_user', JSON.stringify(guestProfile));
    return guestProfile;
  }, []);

  const value = useMemo(
    () => ({
      user,
      login,
      logout,
      isLoginModalOpen,
      setIsLoginModalOpen,
    }),
    [user, login, logout, isLoginModalOpen]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;

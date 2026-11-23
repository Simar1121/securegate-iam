import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const cached = localStorage.getItem('securegate_user');
    try { return cached ? JSON.parse(cached) : null; } catch { return null; }
  });
  const [token, setToken] = useState(() => localStorage.getItem('securegate_token') || null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const savedToken = localStorage.getItem('securegate_token');
    if (!savedToken) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await authService.getMe();
      if (res.success && res.user) {
        setUser(res.user);
        localStorage.setItem('securegate_user', JSON.stringify(res.user));
      }
    } catch (error) {
      console.warn('[AuthContext] Session expired or invalid:', error?.response?.data?.message || error.message);
      setUser(null);
      setToken(null);
      localStorage.removeItem('securegate_token');
      localStorage.removeItem('securegate_user');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refreshUser(); }, [refreshUser]);

  // Password verification starts a challenge only. It never stores an access token.
  const login = async (identifier, password) => authService.login({ identifier, password });

  const verifyLoginOtp = async (challenge) => {
    const res = await authService.verifyLoginOtp(challenge);
    if (res.success && res.token && res.user) {
      setToken(res.token);
      setUser(res.user);
      localStorage.setItem('securegate_token', res.token);
      localStorage.setItem('securegate_user', JSON.stringify(res.user));
    }
    return res;
  };

  const resendLoginOtp = async (challengeId) => authService.resendLoginOtp({ challengeId });

  const register = async (userData) => authService.register(userData);

  const logout = async () => {
    await authService.logout();
    setUser(null);
    setToken(null);
  };

  const updateProfile = async (profileData) => {
    const res = await authService.updateProfile(profileData);
    if (res.success && res.user) {
      setUser(res.user);
      localStorage.setItem('securegate_user', JSON.stringify(res.user));
    }
    return res;
  };

  const changePassword = async (passwords) => authService.changePassword(passwords);

  const hasPermission = useCallback((permissionCode) => {
    if (!user || !user.role) return false;
    if (user.role.name === 'Super Admin') return true;
    return (user.role.permissions || []).some((permission) =>
      typeof permission === 'string' ? permission === permissionCode : permission.code === permissionCode
    );
  }, [user]);

  const hasRole = useCallback((...allowedRoles) => {
    if (!user || !user.role) return false;
    if (user.role.name === 'Super Admin') return true;
    return allowedRoles.includes(user.role.name);
  }, [user]);

  const value = {
    user, token, loading, isAuthenticated: !!token && !!user,
    login, verifyLoginOtp, resendLoginOtp, register, logout, refreshUser,
    updateProfile, changePassword, hasPermission, hasRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

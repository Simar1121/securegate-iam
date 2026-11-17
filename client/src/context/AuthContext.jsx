import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const cached = localStorage.getItem('securegate_user');
    try {
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => localStorage.getItem('securegate_token') || null);
  const [loading, setLoading] = useState(true);

  // Sync current user profile from server on initial load
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
    } catch (err) {
      console.warn('[AuthContext] Session expired or invalid:', err?.response?.data?.message || err.message);
      setUser(null);
      setToken(null);
      localStorage.removeItem('securegate_token');
      localStorage.removeItem('securegate_user');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email, password) => {
    const res = await authService.login({ email, password });
    if (res.success) {
      setToken(res.token);
      setUser(res.user);
      localStorage.setItem('securegate_token', res.token);
      localStorage.setItem('securegate_user', JSON.stringify(res.user));
    }
    return res;
  };

  const register = async (userData) => {
    const res = await authService.register(userData);
    if (res.success) {
      setToken(res.token);
      setUser(res.user);
      localStorage.setItem('securegate_token', res.token);
      localStorage.setItem('securegate_user', JSON.stringify(res.user));
    }
    return res;
  };

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

  const changePassword = async (passwords) => {
    return await authService.changePassword(passwords);
  };

  // RBAC Permission checker
  const hasPermission = useCallback(
    (permissionCode) => {
      if (!user || !user.role) return false;
      // Super Admin bypasses all specific permission gates
      if (user.role.name === 'Super Admin') return true;

      const permissions = user.role.permissions || [];
      return permissions.some((p) => (typeof p === 'string' ? p === permissionCode : p.code === permissionCode));
    },
    [user]
  );

  // Role membership checker
  const hasRole = useCallback(
    (...allowedRoles) => {
      if (!user || !user.role) return false;
      if (user.role.name === 'Super Admin') return true;
      return allowedRoles.includes(user.role.name);
    },
    [user]
  );

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!token && !!user,
    login,
    register,
    logout,
    refreshUser,
    updateProfile,
    changePassword,
    hasPermission,
    hasRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { MainLayout } from '../layouts/MainLayout';
import { ProtectedRoute } from './ProtectedRoute';
import { Login } from '../pages/Login';
import { AcceptInvitation } from '../pages/AcceptInvitation';
import { Dashboard } from '../pages/Dashboard';
import { Users } from '../pages/Users';
import { Roles } from '../pages/Roles';
import { Permissions } from '../pages/Permissions';
import { AbacPolicies } from '../pages/AbacPolicies';
import { AuditLogs } from '../pages/AuditLogs';
import { Profile } from '../pages/Profile';
import { NotFound } from '../pages/NotFound';

const HomeRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role?.name === 'Employee') return <Navigate to="/profile" replace />;
  return <Navigate to="/dashboard" replace />;
};

export const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/accept-invitation" element={<AcceptInvitation />} />
    <Route path="/register" element={<Navigate to="/login" replace />} />
    <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
      <Route index element={<HomeRedirect />} />
      <Route path="dashboard" element={<ProtectedRoute requiredPermission="users:read"><Dashboard /></ProtectedRoute>} />
      <Route path="users" element={<ProtectedRoute requiredPermission="users:read"><Users /></ProtectedRoute>} />
      <Route path="roles" element={<ProtectedRoute requiredPermission="roles:manage"><Roles /></ProtectedRoute>} />
      <Route path="permissions" element={<ProtectedRoute requiredPermission="permissions:manage"><Permissions /></ProtectedRoute>} />
      <Route path="abac-policies" element={<ProtectedRoute allowedRoles={['Super Admin']}><AbacPolicies /></ProtectedRoute>} />
      <Route path="audit-logs" element={<ProtectedRoute requiredPermission="audit:read"><AuditLogs /></ProtectedRoute>} />
      <Route path="profile" element={<Profile />} />
    </Route>
    <Route path="*" element={<NotFound />} />
  </Routes>
);

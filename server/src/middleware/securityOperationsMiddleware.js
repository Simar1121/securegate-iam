import { protect } from './authMiddleware.js';

const readRoles = new Set(['Super Admin', 'IT Administrator', 'Security Auditor']);
const manageRoles = new Set(['Super Admin', 'IT Administrator']);

const allowRoles = (roles) => (req, res, next) => {
  const roleName = req.user?.role?.name;
  if (!roleName || !roles.has(roleName)) {
    return res.status(403).json({ success: false, message: 'You do not have permission to access security operations.' });
  }
  return next();
};

export const requireSecurityAlertRead = [protect, allowRoles(readRoles)];
export const requireSecurityAlertManage = [protect, allowRoles(manageRoles)];

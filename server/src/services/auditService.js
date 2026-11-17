import AuditLog from '../models/AuditLog.js';
import { sanitizeAuditDetails } from '../utils/security.js';

export const logAudit = async ({
  req,
  action,
  category = 'SECURITY',
  actor = null,
  actorEmail = 'system',
  actorName = 'System',
  actorRole = 'System',
  targetType = 'System',
  targetId = null,
  targetName = null,
  status = 'SUCCESS',
  details = {},
}) => {
  try {
    // req.ip is derived by Express; do not trust arbitrary X-Forwarded-For headers.
    const ipAddress = req?.ip || req?.socket?.remoteAddress || '127.0.0.1';

    const userAgent = req?.headers['user-agent'] || 'Unknown Client';

    // If actor is provided via req.user
    if (req?.user && !actor) {
      actor = req.user._id;
      actorEmail = req.user.email;
      actorName = req.user.fullName || `${req.user.firstName} ${req.user.lastName}`;
      actorRole = req.user.role?.name || 'User';
    }

    // Scrub any sensitive password, token, or secret data before persistence
    const sanitizedDetails = sanitizeAuditDetails(details);

    const logEntry = new AuditLog({
      action,
      category,
      actor,
      actorEmail,
      actorName,
      actorRole,
      targetType,
      targetId: targetId ? targetId.toString() : null,
      targetName,
      status,
      ipAddress,
      userAgent,
      details: sanitizedDetails,
    });

    await logEntry.save();
    return logEntry;
  } catch (error) {
    // Non-blocking: Audit logging errors should not crash main transactions,
    // but MUST be visibly monitored and logged to stderr for incident detection
    console.error('[AUDIT LOGGING FAILURE ALERT]:', {
      timestamp: new Date().toISOString(),
      action,
      category,
      actorEmail,
      errorMessage: error.message,
      stack: error.stack,
    });
    return null;
  }
};

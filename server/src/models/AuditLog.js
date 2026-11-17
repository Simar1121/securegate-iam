import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: [true, 'Action is required'],
      trim: true,
      index: true,
    },
    category: {
      type: String,
      enum: ['AUTH', 'USER_MGMT', 'RBAC', 'SECURITY', 'SYSTEM'],
      default: 'SECURITY',
      index: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    actorEmail: {
      type: String,
      required: true,
      trim: true,
      default: 'system',
    },
    actorName: {
      type: String,
      default: 'System',
    },
    actorRole: {
      type: String,
      default: 'None',
    },
    targetType: {
      type: String,
      enum: ['User', 'Role', 'Permission', 'Auth', 'System'],
      default: 'System',
    },
    targetId: {
      type: String,
      default: null,
    },
    targetName: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['SUCCESS', 'FAILED', 'WARNING'],
      default: 'SUCCESS',
      index: true,
    },
    ipAddress: {
      type: String,
      default: '127.0.0.1',
    },
    userAgent: {
      type: String,
      default: 'Unknown',
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ actorEmail: 1 });
auditLogSchema.index({ targetType: 1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;

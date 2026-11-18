import mongoose from 'mongoose';

const deviceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  deviceIdHash: { type: String, required: true },
  deviceName: { type: String, trim: true, maxlength: 100, default: 'Browser device' },
  platform: { type: String, trim: true, maxlength: 80, default: 'Unknown' },
  userAgent: { type: String, trim: true, maxlength: 255, default: 'Unknown' },
  status: { type: String, enum: ['Trusted', 'Revoked', 'Blocked'], default: 'Trusted', index: true },
  trustScore: { type: Number, min: 0, max: 100, default: 100 },
  lastRiskScore: { type: Number, min: 0, max: 100, default: 0 },
  lastRiskLevel: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Low' },
  firstSeenAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now },
  lastLoginAt: { type: Date, default: Date.now },
  lastIpAddress: { type: String, maxlength: 64, default: '' },
  revokedAt: { type: Date, default: null },
}, { timestamps: true });

deviceSchema.index({ userId: 1, deviceIdHash: 1 }, { unique: true });
deviceSchema.index({ userId: 1, lastSeenAt: -1 });

export default mongoose.model('Device', deviceSchema);

import mongoose from 'mongoose';

const riskEventSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', default: null, index: true },
  score: { type: Number, required: true, min: 0, max: 100 },
  level: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], required: true, index: true },
  recommendedAction: { type: String, enum: ['ALLOW', 'REQUIRE_MFA', 'DENY_OR_ADMIN_REVIEW', 'DENY_AND_ALERT'], required: true },
  enforcementDecision: { type: String, enum: ['ALLOW', 'DENY'], required: true },
  reasons: { type: [String], default: [] },
  ipAddress: { type: String, maxlength: 64, default: '' },
  userAgent: { type: String, maxlength: 255, default: '' },
  assessedAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

riskEventSchema.index({ userId: 1, assessedAt: -1 });

export default mongoose.model('RiskEvent', riskEventSchema);

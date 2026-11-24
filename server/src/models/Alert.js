import mongoose from 'mongoose';

const alertSchema = new mongoose.Schema({
  type: { type: String, required: true, index: true },
  severity: { type: String, enum: ['High', 'Critical'], required: true, index: true },
  title: { type: String, required: true, maxlength: 160 },
  description: { type: String, required: true, maxlength: 1000 },
  status: { type: String, enum: ['Open', 'Acknowledged', 'Resolved'], default: 'Open', index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', default: null },
  riskEventId: { type: mongoose.Schema.Types.ObjectId, ref: 'RiskEvent', default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

alertSchema.index({ status: 1, severity: 1, createdAt: -1 });

export default mongoose.model('Alert', alertSchema);

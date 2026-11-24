import mongoose from 'mongoose';

const incidentSchema = new mongoose.Schema({
  alertId: { type: mongoose.Schema.Types.ObjectId, ref: 'Alert', required: true, unique: true },
  title: { type: String, required: true, maxlength: 160 },
  severity: { type: String, enum: ['High', 'Critical'], required: true },
  status: { type: String, enum: ['Open', 'Investigating', 'Contained', 'Resolved'], default: 'Open', index: true },
  source: { type: String, default: 'RISK_ENGINE' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', default: null },
  riskEventId: { type: mongoose.Schema.Types.ObjectId, ref: 'RiskEvent', default: null },
  summary: { type: String, required: true, maxlength: 2000 },
  resolutionNotes: { type: String, maxlength: 2000, default: '' },
}, { timestamps: true });

export default mongoose.model('Incident', incidentSchema);

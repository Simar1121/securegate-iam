import mongoose from 'mongoose';

const conditionSchema = new mongoose.Schema({
  attribute: { type: String, required: true, enum: [
    'subject.role', 'subject.department', 'subject.status',
    'device.trustScore', 'device.status', 'device.platform',
    'resource.ownerId', 'resource.department', 'resource.type',
    'context.riskScore', 'context.ipAddress'
  ]},
  operator: { type: String, required: true, enum: ['eq', 'neq', 'in', 'not_in', 'contains', 'gt', 'gte', 'lt', 'lte'] },
  value: { type: mongoose.Schema.Types.Mixed, required: true }
}, { _id: false });

const abacPolicySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 3, maxlength: 100 },
  description: { type: String, trim: true, maxlength: 500, default: '' },
  effect: { type: String, enum: ['PERMIT', 'DENY'], required: true },
  actions: { type: [String], required: true, validate: v => v.length > 0 && v.length <= 30 },
  resourceTypes: { type: [String], required: true, validate: v => v.length > 0 && v.length <= 20 },
  conditions: { type: [conditionSchema], default: [], validate: v => v.length <= 20 },
  priority: { type: Number, min: 0, max: 1000, default: 100 },
  enabled: { type: Boolean, default: true },
  version: { type: Number, default: 1 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

abacPolicySchema.index({ enabled: 1, priority: -1, createdAt: 1 });
abacPolicySchema.index({ name: 1 }, { unique: true });

export default mongoose.models.AbacPolicy || mongoose.model('AbacPolicy', abacPolicySchema);

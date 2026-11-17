import mongoose from 'mongoose';

const setupStateSchema = new mongoose.Schema({
  _id: { type: String, default: 'organization', immutable: true },
  status: { type: String, enum: ['initializing', 'completed'], required: true },
  completedAt: { type: Date, default: null },
}, { versionKey: false });

export default mongoose.model('SetupState', setupStateSchema);

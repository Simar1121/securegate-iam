import mongoose from 'mongoose';

const adminSeatSchema = new mongoose.Schema({
  seatKey: { type: String, required: true, unique: true },
  roleName: { type: String, enum: ['Super Admin', 'IT Administrator'], required: true, index: true },
  seatNumber: { type: Number, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assignedAt: { type: Date, default: null },
}, { timestamps: true });

adminSeatSchema.index({ roleName: 1, seatNumber: 1 }, { unique: true });
adminSeatSchema.index({ userId: 1 });
adminSeatSchema.index({ roleName: 1, userId: 1 }, { unique: true, partialFilterExpression: { userId: { $type: 'objectId' } } });

export default mongoose.model('AdminSeat', adminSeatSchema);

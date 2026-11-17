import mongoose from 'mongoose';

const permissionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Permission name is required'],
      trim: true,
      unique: true,
    },
    code: {
      type: String,
      required: [true, 'Permission code is required'],
      trim: true,
      unique: true,
      lowercase: true,
    },
    description: {
      type: String,
      required: [true, 'Permission description is required'],
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: ['User Management', 'Role Management', 'Audit & Compliance', 'System Administration'],
      default: 'User Management',
    },
    isSystem: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const Permission = mongoose.model('Permission', permissionSchema);
export default Permission;

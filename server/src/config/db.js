import mongoose from 'mongoose';
import Role from '../models/Role.js';
import Permission from '../models/Permission.js';

const reconcileEmployeeCreationPermissions = async () => {
  const createPermission = await Permission.findOne({ code: 'users:create' }).select('_id');
  if (!createPermission) return;

  const [itAdminRole, hrManagerRole] = await Promise.all([
    Role.findOne({ name: 'IT Administrator' }).select('_id permissions'),
    Role.findOne({ name: 'HR Manager' }).select('_id permissions'),
  ]);

  // Add the employee-onboarding grant only to IT Administrators.
  if (itAdminRole) {
    const hasGrant = itAdminRole.permissions.some(
      (permissionId) => permissionId.toString() === createPermission._id.toString()
    );
    if (!hasGrant) {
      await Role.updateOne(
        { _id: itAdminRole._id },
        { $addToSet: { permissions: createPermission._id } }
      );
      console.log('[Database Migration] Added users:create to IT Administrator.');
    }
  }

  // Remove this one grant from HR Manager; all other permissions and records remain untouched.
  if (hrManagerRole) {
    const hasGrant = hrManagerRole.permissions.some(
      (permissionId) => permissionId.toString() === createPermission._id.toString()
    );
    if (hasGrant) {
      await Role.updateOne(
        { _id: hrManagerRole._id },
        { $pull: { permissions: createPermission._id } }
      );
      console.log('[Database Migration] Removed users:create from HR Manager.');
    }
  }
};

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/securegate_db');
    console.log(`[Database] MongoDB Connected: ${conn.connection.host} / ${conn.connection.name}`);
    await reconcileEmployeeCreationPermissions();
    return conn;
  } catch (error) {
    console.error(`[Database Error] Failed to connect to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;

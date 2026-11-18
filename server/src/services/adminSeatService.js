import AdminSeat from '../models/AdminSeat.js';
import Role from '../models/Role.js';
import User from '../models/User.js';

const SEAT_DEFINITIONS = [
  { seatKey: 'SUPER_ADMIN_1', roleName: 'Super Admin', seatNumber: 1 },
  { seatKey: 'IT_ADMIN_1', roleName: 'IT Administrator', seatNumber: 1 },
  { seatKey: 'IT_ADMIN_2', roleName: 'IT Administrator', seatNumber: 2 },
  { seatKey: 'IT_ADMIN_3', roleName: 'IT Administrator', seatNumber: 3 },
];

export const ensureAdminSeatInventory = async () => {
  for (const seat of SEAT_DEFINITIONS) {
    try {
      await AdminSeat.updateOne(
        { seatKey: seat.seatKey },
        { $setOnInsert: { ...seat, userId: null, assignedAt: null } },
        { upsert: true }
      );
    } catch (error) {
      // Concurrent first-use requests may race to create the same unique slot.
      if (error.code !== 11000) throw error;
    }
  }
};

// Reconcile seat records from existing users. Existing user records are never
// deleted or demoted by this routine; excess legacy admins are surfaced by
// the capacity checks and must be reviewed by an organization owner.
export const synchronizeAdminSeats = async () => {
  await ensureAdminSeatInventory();

  for (const roleName of ['Super Admin', 'IT Administrator']) {
    const role = await Role.findOne({ name: roleName });
    if (!role) continue;

    const seats = await AdminSeat.find({ roleName });
    for (const seat of seats) {
      if (!seat.userId) continue;
      const stillOwnsSeat = await User.exists({ _id: seat.userId, role: role._id });
      if (!stillOwnsSeat) {
        seat.userId = null;
        seat.assignedAt = null;
        await seat.save();
      }
    }

    const users = await User.find({ role: role._id }).sort({ createdAt: 1, _id: 1 }).select('_id');
    for (const user of users) {
      const alreadyAssigned = await AdminSeat.exists({ roleName, userId: user._id });
      if (alreadyAssigned) continue;
      try {
        await AdminSeat.findOneAndUpdate(
          { roleName, userId: null },
          { $set: { userId: user._id, assignedAt: new Date() } },
          { new: true, sort: { seatNumber: 1 } }
        );
      } catch (error) {
        // Another reconciler may have mapped this same identity concurrently.
        if (error.code !== 11000) throw error;
      }
    }
  }
};

export const reserveAdminSeat = async (roleName, userId) => {
  if (!['Super Admin', 'IT Administrator'].includes(roleName)) return null;

  await synchronizeAdminSeats();
  const existing = await AdminSeat.findOne({ roleName, userId });
  if (existing) return existing;

  let seat;
  try {
    seat = await AdminSeat.findOneAndUpdate(
      { roleName, userId: null },
      { $set: { userId, assignedAt: new Date() } },
      { new: true, sort: { seatNumber: 1 } }
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
    seat = await AdminSeat.findOne({ roleName, userId });
  }

  if (!seat) {
    const limit = roleName === 'Super Admin' ? 1 : 3;
    throw new Error(`The ${roleName} capacity (${limit}) has been reached.`);
  }
  return seat;
};

export const releaseAdminSeat = async (userId) => {
  await AdminSeat.updateOne(
    { userId },
    { $set: { userId: null, assignedAt: null } }
  );
};

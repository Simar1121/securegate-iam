// Build device ownership attributes only from a server-side lookup scoped to
// the authenticated user. Invalid, foreign, and missing IDs intentionally resolve
// to an empty resource context; the controller preserves its validation/404 response.
export const createOwnedDeviceAttributesResolver = ({ Device, isValidObjectId }) =>
  async (req) => {
    if (!isValidObjectId(req.params.id)) return {};
    const device = await Device.findOne({
      _id: req.params.id,
      userId: req.user._id,
    }).select('userId').lean();

    return device ? { ownerId: device.userId } : {};
  };

import { asyncHandler } from "../utils/async-handler.js";
import {
  changeOwnPassword,
  getProfile,
  updateProfile
} from "../services/profile.service.js";

export const get = asyncHandler(async (req, res) => {
  const user = await getProfile(req.user.id);
  res.status(200).json({ user });
});

export const update = asyncHandler(async (req, res) => {
  const user = await updateProfile({
    userId: req.user.id,
    payload: req.body ?? {}
  });
  res.status(200).json({ user });
});

export const changePassword = asyncHandler(async (req, res) => {
  await changeOwnPassword({
    userId: req.user.id,
    currentPassword: req.body?.currentPassword,
    newPassword: req.body?.newPassword,
    confirmPassword: req.body?.confirmPassword
  });
  res.status(200).json({ ok: true });
});

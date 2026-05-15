import { asyncHandler } from "../utils/async-handler.js";
import {
  createUser,
  listUsers,
  resetUserPassword,
  setUserActive,
  updateUser
} from "../services/users.service.js";

export const list = asyncHandler(async (_req, res) => {
  const users = await listUsers();
  res.status(200).json({ users });
});

export const create = asyncHandler(async (req, res) => {
  const user = await createUser({ payload: req.body ?? {} });
  res.status(201).json({ user });
});

export const update = asyncHandler(async (req, res) => {
  const user = await updateUser({
    targetId: req.params.id,
    actorId: req.user.id,
    payload: req.body ?? {}
  });
  res.status(200).json({ user });
});

export const toggleActive = asyncHandler(async (req, res) => {
  const user = await setUserActive({
    targetId: req.params.id,
    actorId: req.user.id,
    isActive: Boolean(req.body?.isActive)
  });
  res.status(200).json({ user });
});

export const resetPassword = asyncHandler(async (req, res) => {
  await resetUserPassword({
    targetId: req.params.id,
    newPassword: req.body?.password
  });
  res.status(200).json({ ok: true });
});

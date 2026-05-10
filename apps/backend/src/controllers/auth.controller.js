import { loginWithEmailPassword } from "../services/auth.service.js";

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const data = await loginWithEmailPassword({ email, password });
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
}

export async function me(req, res) {
  return res.status(200).json({ user: req.user });
}

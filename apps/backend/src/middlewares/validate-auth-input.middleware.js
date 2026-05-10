import { AppError } from "../utils/app-error.js";

export function validateLoginInput(req, _res, next) {
  const { email, password } = req.body ?? {};

  if (typeof email !== "string" || typeof password !== "string") {
    return next(new AppError("Email y password son requeridos.", 400));
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return next(new AppError("Email invalido.", 400));
  }

  if (password.length < 6) {
    return next(new AppError("Password invalido.", 400));
  }

  req.body.email = normalizedEmail;
  return next();
}

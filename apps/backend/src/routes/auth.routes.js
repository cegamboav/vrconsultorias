import { Router } from "express";
import { login, me } from "../controllers/auth.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { authLoginRateLimit } from "../middlewares/rate-limit.middleware.js";
import { validateLoginInput } from "../middlewares/validate-auth-input.middleware.js";

const authRouter = Router();

authRouter.post("/login", authLoginRateLimit, validateLoginInput, login);
authRouter.get("/me", requireAuth, me);
authRouter.get("/admin-only", requireAuth, requireRole("ADMIN"), (_req, res) => {
  res.status(200).json({ message: "Ruta solo para administradores." });
});

export default authRouter;

import { Router } from "express";
import { login, me } from "../controllers/auth.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";

const authRouter = Router();

authRouter.post("/login", login);
authRouter.get("/me", requireAuth, me);
authRouter.get("/admin-only", requireAuth, requireRole("ADMIN"), (_req, res) => {
  res.status(200).json({ message: "Ruta solo para administradores." });
});

export default authRouter;

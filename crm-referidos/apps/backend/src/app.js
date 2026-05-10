import cors from "cors";
import express from "express";
import morgan from "morgan";
import { env } from "./config/env.js";
import { requireAuth } from "./middlewares/auth.middleware.js";
import authRouter from "./routes/auth.routes.js";
import healthRouter from "./routes/health.routes.js";

const app = express();

app.use(
  cors({
    origin: env.frontendUrl
  })
);
app.use(express.json());
app.use(morgan("dev"));

app.get("/", (_req, res) => {
  res.json({
    message: "CRM Referidos API",
    docs: ["/api/health", "/auth/login", "/auth/me"]
  });
});

app.use("/api/health", healthRouter);
app.use("/auth", authRouter);
app.get("/api/protected", requireAuth, (req, res) => {
  res.status(200).json({
    message: "Ruta protegida activa.",
    user: req.user
  });
});

export default app;

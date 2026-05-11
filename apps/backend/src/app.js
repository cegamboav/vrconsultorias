import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middlewares/error-handler.middleware.js";
import { requireAuth } from "./middlewares/auth.middleware.js";
import authRouter from "./routes/auth.routes.js";
import healthRouter from "./routes/health.routes.js";
import privateLeadsRouter from "./routes/private/leads.routes.js";

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: [env.frontendUrl],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false
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
app.use("/api/private/leads", requireAuth, privateLeadsRouter);
app.get("/api/protected", requireAuth, (req, res) => {
  res.status(200).json({
    message: "Ruta protegida activa.",
    user: req.user
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

export default app;

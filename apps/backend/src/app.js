import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middlewares/error-handler.middleware.js";
import { requireAuth } from "./middlewares/auth.middleware.js";
import authRouter from "./routes/auth.routes.js";
import healthRouter from "./routes/health.routes.js";
import privateDashboardRouter from "./routes/private/dashboard.routes.js";
import privateLeadsRouter from "./routes/private/leads.routes.js";
import privateReportsRouter from "./routes/private/reports.routes.js";
import privateFollowUpAgentRouter from "./routes/private/follow-up-agent.routes.js";
import privateUsersRouter from "./routes/private/users.routes.js";
import privateServiceCategoriesRouter from "./routes/private/service-categories.routes.js";
import privateProfileRouter from "./routes/private/profile.routes.js";
import webhookRouter from "./routes/public/whatsapp-webhook.routes.js";

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

// Capture raw body for HMAC verification BEFORE global JSON parser
// (express.json() discards the raw buffer; this scope-limits the raw parser
//  to the webhook path and re-attaches a parsed body for the rest of the app)
app.use('/api/webhooks/whatsapp', express.raw({ type: 'application/json' }), (req, _res, next) => {
  req.rawBody = req.body;
  req.body = req.body && req.body.length ? JSON.parse(req.body) : {};
  next();
});

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
app.use("/api/webhooks/whatsapp", webhookRouter);
app.use("/api/private/dashboard", requireAuth, privateDashboardRouter);
app.use("/api/private/leads", requireAuth, privateLeadsRouter);
app.use("/api/private/reports", requireAuth, privateReportsRouter);
app.use("/api/private/follow-up-agent", requireAuth, privateFollowUpAgentRouter);
app.use("/api/private/users", requireAuth, privateUsersRouter);
app.use("/api/private/service-categories", requireAuth, privateServiceCategoriesRouter);
app.use("/api/private/profile", requireAuth, privateProfileRouter);
app.get("/api/protected", requireAuth, (req, res) => {
  res.status(200).json({
    message: "Ruta protegida activa.",
    user: req.user
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

export default app;

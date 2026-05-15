import dotenv from "dotenv";

dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:5173",
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  whatsapp: {
    provider: process.env.WHATSAPP_PROVIDER ?? 'noop',
    apiVersion: process.env.WHATSAPP_API_VERSION ?? 'v21.0',
    token: process.env.WHATSAPP_TOKEN ?? null,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? null,
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID ?? null,
    webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? null,
  },
  followUpAgent: {
    enabled: process.env.FOLLOW_UP_AGENT_ENABLED === 'true',
    cron: process.env.FOLLOW_UP_AGENT_CRON ?? '0 9 * * *',
    timezone: process.env.FOLLOW_UP_AGENT_TZ ?? 'America/Costa_Rica',
    dryRun: process.env.FOLLOW_UP_AGENT_DRY_RUN !== 'false',
    batchSize: Number(process.env.FOLLOW_UP_AGENT_BATCH_SIZE ?? 50),
    mode: process.env.FOLLOW_UP_AGENT_MODE ?? 'rule-based',
    claudeModel: process.env.CLAUDE_AGENT_MODEL ?? null,
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY ?? null,
  },
};

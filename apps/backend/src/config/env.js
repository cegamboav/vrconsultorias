import dotenv from "dotenv";

dotenv.config();

const nodeEnv = process.env.NODE_ENV ?? "development";
const isProduction = nodeEnv === "production";

/**
 * JWT sin secreto placeholder. En producción JWT_SECRET es obligatorio y robusto.
 */
function resolveJwtSecret() {
  const raw = process.env.JWT_SECRET;
  const secret = typeof raw === "string" ? raw.trim() : "";

  const minLen = isProduction ? 32 : 16;

  if (secret.length >= minLen) {
    return secret;
  }

  const lines = [
    "",
    "[CRM API] JWT_SECRET es inválido o ausente.",
    isProduction
      ? "→ En PRODUCCIÓN defines JWT_SECRET en el entorno del servidor (cadena aleatoria sólida, mínimo 32 caracteres). La API no arranca sin él."
      : "→ En desarrollo define JWT_SECRET en .env con al menos 16 caracteres (recomendado 32+, igual que prod).",
    "",
    `  NODE_ENV=${nodeEnv}`,
    `  longitud_detectada=${secret.length}`,
    `  minimo_requerido=${minLen}`,
    "",
    "JWT_EXPIRES_IN sigue siendo opcional (p. ej. 7d, 24h).",
    ""
  ].join("\n");

  console.error(lines);
  process.exit(1);
}

/** Valores válidos para jsonwebtoken expiresIn (p. ej. 7d, 24h, 3600). */
function resolveJwtExpiresIn() {
  const raw = process.env.JWT_EXPIRES_IN;
  if (!raw || !String(raw).trim()) return "7d";
  return String(raw).trim();
}

export const env = {
  nodeEnv,
  port: Number(process.env.PORT ?? 4000),
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:5173",
  jwtSecret: resolveJwtSecret(),
  jwtExpiresIn: resolveJwtExpiresIn(),
  whatsapp: {
    provider: process.env.WHATSAPP_PROVIDER ?? 'noop',
    apiVersion: process.env.WHATSAPP_API_VERSION ?? 'v21.0',
    token: process.env.WHATSAPP_TOKEN ?? null,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? null,
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID ?? null,
    webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? null,
    appSecret: process.env.WHATSAPP_APP_SECRET ?? null,
  },
  inboundClassifier: {
    enabled: process.env.INBOUND_CLASSIFIER_ENABLED === 'true',
    model: process.env.INBOUND_CLASSIFIER_MODEL ?? 'claude-haiku-4-5-20251001',
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

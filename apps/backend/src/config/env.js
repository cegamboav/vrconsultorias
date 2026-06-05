import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Monorepo root (.env junto a package.json), aunque el cwd sea apps/backend
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });
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

function resolveOpenAiApiKey() {
  const key = String(process.env.OPENAI_API_KEY ?? "").trim();
  return key || null;
}

function resolveOpenAiModel() {
  const model = String(process.env.OPENAI_MODEL ?? "").trim();
  return model || "gpt-4o-mini";
}

export const env = {
  nodeEnv,
  port: Number(process.env.PORT ?? 4000),
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:5173",
  jwtSecret: resolveJwtSecret(),
  jwtExpiresIn: resolveJwtExpiresIn(),
  assistantEnabled:
    String(process.env.ASSISTANT_ENABLED ?? "true").toLowerCase() === "true",
  openaiApiKey: resolveOpenAiApiKey(),
  openaiModel: resolveOpenAiModel()
};

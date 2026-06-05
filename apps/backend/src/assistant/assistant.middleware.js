import { env } from "../config/env.js";

/** Bloquea rutas operativas del asistente cuando ASSISTANT_ENABLED=false. */
export function requireAssistantEnabled(_req, res, next) {
  if (!env.assistantEnabled) {
    return res.status(403).json({
      message: "El asistente IA está deshabilitado para esta instalación."
    });
  }
  next();
}

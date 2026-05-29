import { env } from "../config/env.js";
import { AppError } from "../utils/app-error.js";
import { logAudit, AuditAction } from "../services/audit.service.js";
import {
  ASSISTANT_ACTION_TYPES,
  buildInterpreterSystemPrompt,
  buildInterpreterUserPrompt
} from "./assistant.prompts.js";
import {
  EXECUTABLE_ACTIONS,
  executeAssistantAction,
  normalizeInterpretation
} from "./assistant.actions.js";

async function callOpenAiInterpreter(message) {
  const apiKey = env.openaiApiKey;
  if (!apiKey) {
    throw new AppError(
      "El asistente no está configurado: falta OPENAI_API_KEY en el entorno del backend.",
      503
    );
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: env.openaiModel,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildInterpreterSystemPrompt() },
        { role: "user", content: buildInterpreterUserPrompt(message) }
      ]
    })
  });

  if (!response.ok) {
    throw new AppError(`OpenAI no respondió correctamente (${response.status}).`, 502);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new AppError("OpenAI devolvió una respuesta vacía.", 502);
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new AppError("No se pudo interpretar la respuesta del modelo.", 502);
  }

  return normalizeInterpretation(parsed);
}

function buildReply({ interpretation, executed, result, errorMessage }) {
  if (errorMessage) {
    return errorMessage;
  }

  const { action } = interpretation;

  if (action === "CLARIFY") {
    return (
      interpretation.clarification ??
      "Necesito un poco más de detalle para ejecutar esa acción."
    );
  }

  if (action === "UNKNOWN") {
    return "No reconocí una acción del CRM en tu mensaje. Puedo buscar leads, cambiar estado, agregar notas o programar seguimiento.";
  }

  if (!executed && result?.needsDisambiguation) {
    const names = (result.candidates ?? [])
      .map((c) => `#${c.leadNumber} ${c.fullName}`)
      .join(", ");
    return `Encontré varios leads: ${names}. Indica el número de lead o el nombre completo.`;
  }

  if (!executed) {
    return "Interpreté tu mensaje pero no ejecuté cambios.";
  }

  switch (action) {
    case "SEARCH_LEAD_BY_NAME": {
      const n = result?.leads?.length ?? 0;
      if (n === 0) return "No encontré leads con ese criterio.";
      if (n === 1) {
        const l = result.leads[0];
        return `Encontré 1 lead: #${l.leadNumber} ${l.fullName} (${l.status}).`;
      }
      return `Encontré ${n} leads. Revisa la lista en result.leads.`;
    }
    case "MOVE_LEAD_STATUS":
      return `Estado actualizado para ${result?.lead?.fullName ?? "el lead"}.`;
    case "SCHEDULE_FOLLOW_UP":
      return `Seguimiento programado para ${result?.lead?.fullName ?? "el lead"}.`;
    case "ADD_NOTE":
      return `Nota agregada al timeline de ${result?.lead?.fullName ?? "el lead"}.`;
    default:
      return "Acción completada.";
  }
}

/**
 * @param {{ userId: string, userName?: string, message: string }} input
 */
export async function processAssistantChat({ userId, userName, message }) {
  const text = String(message ?? "").trim();
  if (!text) {
    throw new AppError("El mensaje no puede estar vacío.", 400);
  }
  if (text.length > 2000) {
    throw new AppError("El mensaje es demasiado largo (máximo 2000 caracteres).", 400);
  }

  const interpretation = await callOpenAiInterpreter(text);

  await logAudit({
    actorId: userId,
    action: AuditAction.ASSISTANT_CHAT,
    description: `${userName ?? "Usuario"} usó el asistente.`,
    metadata: {
      source: "assistant",
      interpretation,
      messagePreview: text.slice(0, 200)
    }
  });

  if (interpretation.action === "CLARIFY" || interpretation.action === "UNKNOWN") {
    return {
      interpretation,
      executed: false,
      result: null,
      reply: buildReply({ interpretation, executed: false, result: null })
    };
  }

  if (!EXECUTABLE_ACTIONS.has(interpretation.action)) {
    return {
      interpretation,
      executed: false,
      result: null,
      reply: buildReply({ interpretation, executed: false, result: null })
    };
  }

  const result = await executeAssistantAction({
    interpretation,
    userId,
    userMessage: text
  });

  const executed = !result?.needsDisambiguation;

  return {
    interpretation,
    executed,
    result,
    reply: buildReply({ interpretation, executed, result })
  };
}

export function getAssistantCapabilities() {
  return {
    configured: Boolean(env.openaiApiKey),
    model: env.openaiModel,
    supportedActions: ASSISTANT_ACTION_TYPES.filter((a) =>
      ["SEARCH_LEAD_BY_NAME", "MOVE_LEAD_STATUS", "SCHEDULE_FOLLOW_UP", "ADD_NOTE"].includes(
        a
      )
    ),
    architecture: "interpret → validate → existing services → Prisma (via leads.service)"
  };
}

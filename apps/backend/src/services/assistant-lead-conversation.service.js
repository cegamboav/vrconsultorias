import { statusChangeTimelineLabelEs } from "../constants/lead-copy.es.js";
import { AppError } from "../utils/app-error.js";
import {
  formatActiveServiceNamesHint,
  resolveServiceCategoryByNameOrSlug
} from "./service-categories.service.js";
import { executeCreateLeadFromAssistant } from "../assistant/assistant.actions.js";

/** Memoria temporal en proceso (no persiste en BD). */
const sessions = new Map();

const SESSION_TTL_MS = 30 * 60 * 1000;

const CANCEL_PATTERN = /^(cancelar|detener|olvidar)$/i;

const STEPS = ["fullName", "phone", "serviceCategory"];

function getSession(userId) {
  const session = sessions.get(userId);
  if (!session) return null;
  if (Date.now() - session.updatedAt > SESSION_TTL_MS) {
    sessions.delete(userId);
    return null;
  }
  return session;
}

function getNextStep(data) {
  if (!data.fullName) return "fullName";
  if (!data.phone) return "phone";
  if (!data.serviceCategory) return "serviceCategory";
  return null;
}

function normalizePartialData(partial = {}) {
  return {
    fullName: partial.fullName ? String(partial.fullName).trim() : null,
    phone: partial.phone ? String(partial.phone).trim() : null,
    serviceCategory: partial.serviceCategory ? String(partial.serviceCategory).trim() : null
  };
}

async function promptForStep(step) {
  if (step === "fullName") {
    return "Perfecto. ¿Cuál es el nombre completo?";
  }
  if (step === "phone") {
    return "¿Cuál es el teléfono?";
  }
  const hint = await formatActiveServiceNamesHint();
  return hint
    ? `¿Cuál es el servicio? (${hint})`
    : "¿Cuál es el servicio? (Inversiones, Charlas o Contabilidad)";
}

function validateFullName(value) {
  const trimmed = String(value ?? "").trim();
  if (trimmed.length < 2) {
    return { ok: false, message: "Indica el nombre completo (mínimo 2 caracteres)." };
  }
  return { ok: true, value: trimmed };
}

function validatePhone(value) {
  const trimmed = String(value ?? "").trim();
  if (trimmed.length < 6) {
    return { ok: false, message: "Indica un teléfono válido (mínimo 6 caracteres)." };
  }
  return { ok: true, value: trimmed };
}

export function isLeadConversationCancelMessage(message) {
  return CANCEL_PATTERN.test(String(message ?? "").trim());
}

export function hasActiveLeadConversation(userId) {
  return Boolean(getSession(userId));
}

export function clearLeadConversationSession(userId) {
  return sessions.delete(userId);
}

export function formatLeadCreatedConversationReply(result) {
  const statusLabel = statusChangeTimelineLabelEs[result.status] ?? "Nuevo";
  return `Lead creado correctamente.\n\nLead #${result.leadNumber}\n${result.fullName}\n${result.service}\nEstado: ${statusLabel}.`;
}

function conversationTurn({ step, collected, reply }) {
  return {
    action: "CREATE_LEAD_CONVERSATION",
    conversationActive: true,
    step,
    collected,
    reply
  };
}

async function finalizeLeadConversation({ userId, data, userMessage, resolvedCategory }) {
  const result = await executeCreateLeadFromAssistant({
    interpretation: {
      action: "CREATE_LEAD",
      fullName: data.fullName,
      phone: data.phone,
      serviceCategory: data.serviceCategory ?? resolvedCategory?.name
    },
    userId,
    userMessage,
    resolvedCategory
  });

  if (result?.needsClarification) {
    const isPhoneConflict = String(result.clarification ?? "").includes("teléfono");
    const step = isPhoneConflict ? "phone" : (getNextStep(data) ?? "serviceCategory");
    if (isPhoneConflict) {
      data.phone = null;
    }
    sessions.set(userId, { data, step, updatedAt: Date.now() });
    return conversationTurn({
      step,
      collected: data,
      reply: result.clarification
    });
  }

  return {
    action: "CREATE_LEAD",
    conversationActive: false,
    executed: true,
    result,
    reply: formatLeadCreatedConversationReply(result)
  };
}

/** Inicia flujo guiado con datos parciales opcionales. */
export async function beginLeadConversation(userId, partial = {}) {
  const data = normalizePartialData(partial);
  const step = getNextStep(data);

  if (!step) {
    return finalizeLeadConversation({ userId, data, userMessage: null });
  }

  sessions.set(userId, { data, step, updatedAt: Date.now() });

  return conversationTurn({
    step,
    collected: { ...data },
    reply: await promptForStep(step)
  });
}

/** Avanza un paso con el mensaje del usuario en sesión activa. */
export async function advanceLeadConversation({ userId, message }) {
  const session = getSession(userId);
  if (!session) return null;

  session.updatedAt = Date.now();
  const text = String(message ?? "").trim();

  if (session.step === "fullName") {
    const check = validateFullName(text);
    if (!check.ok) {
      return conversationTurn({
        step: "fullName",
        collected: session.data,
        reply: check.message
      });
    }
    session.data.fullName = check.value;
    session.step = "phone";
    sessions.set(userId, session);
    return conversationTurn({
      step: "phone",
      collected: { ...session.data },
      reply: await promptForStep("phone")
    });
  }

  if (session.step === "phone") {
    const check = validatePhone(text);
    if (!check.ok) {
      return conversationTurn({
        step: "phone",
        collected: session.data,
        reply: check.message
      });
    }
    session.data.phone = check.value;
    session.step = "serviceCategory";
    sessions.set(userId, session);
    return conversationTurn({
      step: "serviceCategory",
      collected: { ...session.data },
      reply: await promptForStep("serviceCategory")
    });
  }

  if (session.step === "serviceCategory") {
    const resolved = await resolveServiceCategoryByNameOrSlug(text);
    if (resolved.ambiguous) {
      const names = resolved.candidates.map((c) => c.name).join(", ");
      return conversationTurn({
        step: "serviceCategory",
        collected: session.data,
        reply: `Encontré varios servicios: ${names}. ¿Cuál corresponde?`
      });
    }
    if (resolved.notFound || !resolved.category) {
      const hint = await formatActiveServiceNamesHint();
      return conversationTurn({
        step: "serviceCategory",
        collected: session.data,
        reply: hint
          ? `Servicio no reconocido. Opciones: ${hint}.`
          : "Servicio no reconocido. Indica Inversiones, Charlas o Contabilidad."
      });
    }

    session.data.serviceCategory = resolved.category.name;
    sessions.delete(userId);

    return finalizeLeadConversation({
      userId,
      data: session.data,
      userMessage: text,
      resolvedCategory: resolved.category
    });
  }

  return null;
}

export function cancelLeadConversation(userId) {
  const had = clearLeadConversationSession(userId);
  return {
    action: "CREATE_LEAD_CONVERSATION",
    cancelled: true,
    conversationActive: false,
    reply: had ? "Proceso de creación cancelado." : null
  };
}

export { STEPS as LEAD_CONVERSATION_STEPS };

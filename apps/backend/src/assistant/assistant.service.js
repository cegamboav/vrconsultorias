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
  isCreateLeadInputComplete,
  normalizeInterpretation
} from "./assistant.actions.js";
import {
  advanceLeadConversation,
  beginLeadConversation,
  cancelLeadConversation,
  formatLeadCreatedConversationReply,
  hasActiveLeadConversation,
  isLeadConversationCancelMessage
} from "../services/assistant-lead-conversation.service.js";
import {
  buildSmartStatusDisambiguationReply,
  buildSmartStatusSuccessReply
} from "../services/smart-status.service.js";
import {
  buildInterpretationFromAssistantContext,
  inferPersistContextFromClarify,
  isStandaloneSpanishStatusMessage,
  NO_PENDING_CONTEXT_REPLY,
  shouldClearContextAfterAction
} from "../services/assistant-context-resolver.service.js";
import { buildAddLeadNoteChoiceReply } from "../services/assistant-lead-note.service.js";
import { buildResumeLeadDisambiguationReply } from "../services/lead-resume.service.js";
import { buildSuggestNextActionDisambiguationReply } from "../services/lead-suggest-action.service.js";
import { buildGenerateContactMessageDisambiguationReply, buildGenerateMultipleContactMessagesDisambiguationReply, buildMultipleMessageSelectionClarificationReply, buildMessageRefinementClarificationReply, resolveMessageRefinement, normalizeRefinementText, NO_SELECTED_MESSAGE_REPLY } from "../services/lead-contact-message.service.js";
import { PENDING_ACTIONS, getRefinementContextMessage, readAssistantContextMetadata } from "../services/assistant-conversation-context.service.js";
import {
  clearAssistantContext,
  getActiveAssistantContext,
  saveAssistantContext
} from "../services/assistant-conversation-context.service.js";

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

function buildConversationChatResponse(turn) {
  if (turn.executed && turn.result) {
    return {
      interpretation: { action: "CREATE_LEAD", viaConversation: true },
      executed: true,
      result: turn.result,
      reply: turn.reply
    };
  }

  return {
    interpretation: {
      action: "CREATE_LEAD_CONVERSATION",
      step: turn.step ?? null,
      collected: turn.collected ?? null,
      cancelled: turn.cancelled ?? false
    },
    executed: false,
    result: {
      conversationActive: turn.conversationActive ?? !turn.cancelled,
      step: turn.step ?? null,
      collected: turn.collected ?? null,
      cancelled: turn.cancelled ?? false
    },
    reply: turn.reply
  };
}

async function logAssistantChatUsage({ userId, userName, interpretation, messagePreview }) {
  await logAudit({
    actorId: userId,
    action: AuditAction.ASSISTANT_CHAT,
    description: `${userName ?? "Usuario"} usó el asistente.`,
    metadata: {
      source: "assistant",
      interpretation,
      messagePreview
    }
  });
}

function shouldStartLeadConversation(interpretation) {
  if (interpretation.action === "CREATE_LEAD_CONVERSATION") {
    return true;
  }
  if (interpretation.action === "CREATE_LEAD" && !isCreateLeadInputComplete(interpretation)) {
    return true;
  }
  return false;
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
    return "No reconocí una acción del CRM en tu mensaje. Puedo consultar leads, resumir el pipeline, listar seguimientos pendientes, buscar, cambiar estado, agregar notas o programar seguimiento.";
  }

  if (!executed && result?.needsDisambiguation) {
    if (result.disambiguationMessage) {
      return result.disambiguationMessage;
    }
    if (action === "SMART_STATUS_UPDATE") {
      return buildSmartStatusDisambiguationReply(
        interpretation.leadName ?? result.leadName
      );
    }
    const names = (result.candidates ?? [])
      .map((c) => `#${c.leadNumber} ${c.fullName}`)
      .join(", ");
    return `Encontré varios leads: ${names}. Indica el número de lead o el nombre completo.`;
  }

  if (!executed) {
    return "Interpreté tu mensaje pero no pude completar la solicitud.";
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
    case "GET_LEAD_STATUS": {
      const next = result.nextActionDateLabel
        ? ` Próxima acción: ${result.nextActionDateLabel}.`
        : "";
      return `${result.fullName} está en ${result.statusLabel} (${result.service ?? "sin servicio"}).${next}`;
    }
    case "GET_LEAD_DETAILS": {
      const next = result.nextActionDateLabel
        ? ` Próximo seguimiento: ${result.nextActionDateLabel}.`
        : "";
      return `#${result.leadNumber} ${result.fullName} · ${result.statusLabel} · ${result.service ?? "sin servicio"} · ${result.phone}.${next}`;
    }
    case "GET_LEAD_TIMELINE_SUMMARY":
      return result.summaryText ?? "No hay historial disponible para este lead.";
    case "RESUME_LEAD":
      return result.summaryText ?? `Resumen de ${result.fullName ?? "el lead"}.`;
    case "SUGGEST_NEXT_ACTION":
      return result.summaryText ?? result.recommendation ?? "Recomendación generada.";
    case "GENERATE_CONTACT_MESSAGE":
      return result.summaryText ?? result.message ?? "Mensaje generado.";
    case "GENERATE_MULTIPLE_CONTACT_MESSAGES":
      return result.summaryText ?? "Opciones de mensaje generadas.";
    case "SELECT_GENERATED_MESSAGE_OPTION":
      return result.summaryText ?? result.message ?? "Opción seleccionada.";
    case "REFINE_SELECTED_MESSAGE":
      return result.summaryText ?? result.message ?? "Mensaje refinado.";
    case "COUNT_LEADS_BY_STATUS":
      return result.replyText ?? buildCountAllLeadsReply(result);
    case "LIST_LEADS_BY_STATUS":
      return result.replyText ?? "Listado de leads completado.";
    case "GET_PENDING_FOLLOWUPS": {
      const n = result.count ?? 0;
      if (n === 0) return "No tienes seguimientos pendientes para hoy.";
      if (n === 1) {
        const l = result.leads[0];
        return `1 seguimiento pendiente: #${l.leadNumber} ${l.fullName} (${l.nextActionDateLabel}).`;
      }
      return `${n} seguimientos pendientes para hoy. Revisa result.leads.`;
    }
    case "GET_TODAY_AGENDA":
      return result.summaryText ?? "No tienes acciones pendientes para hoy.";
    case "GET_ACTIONABLE_LEADS":
      return result.summaryText ?? "No tienes acciones pendientes de seguimiento para hoy.";
    case "GET_TOMORROW_AGENDA":
      return result.summaryText ?? "No tienes acciones programadas para mañana.";
    case "GET_UPCOMING_FOLLOWUPS":
      return result.summaryText ?? "No tienes seguimientos programados en ese periodo.";
    case "GET_PRIORITY_LEADS":
      return result.summaryText ?? "No tienes leads abiertos para priorizar.";
    case "GET_OVERVIEW":
      return result.summaryText ?? "No hay datos de resumen disponibles.";
    case "GET_WEEKLY_BUSINESS_SUMMARY":
      return result.summaryText ?? "No hay datos del resumen semanal.";
    case "GET_BUSINESS_INSIGHTS":
      return result.summaryText ?? "No hay insights disponibles.";
    case "GET_BUSINESS_RECOMMENDATIONS":
      return result.summaryText ?? "No hay recomendaciones comerciales disponibles.";
    case "GET_RECOMMENDED_TASKS":
      return result.summaryText ?? "No hay tareas recomendadas.";
    case "GET_OVERDUE_FOLLOWUPS":
      return result.summaryText ?? "No tienes seguimientos atrasados.";
    case "GET_OLDEST_UNCONTACTED_LEADS": {
      const n = result.count ?? 0;
      if (n === 0) return "No hay leads pendientes de primer contacto.";
      if (n === 1) {
        const l = result.leads[0];
        return `1 lead sin contactar: #${l.leadNumber} ${l.fullName} (desde ${l.createdAtLabel}).`;
      }
      return `${n} leads sin contactar (más antiguos primero). Revisa result.leads.`;
    }
    case "CREATE_LEAD":
      return formatLeadCreatedConversationReply(result);
    case "SMART_STATUS_UPDATE":
      return buildSmartStatusSuccessReply({
        fullName: result.fullName ?? result.lead?.fullName ?? "El lead",
        targetStatus: result.targetStatus,
        followUpReason: result.followUpReason,
        days: result.days
      });
    case "MOVE_LEAD_STATUS":
      return `Estado actualizado para ${result?.lead?.fullName ?? "el lead"}.`;
    case "SCHEDULE_FOLLOW_UP":
      return `Seguimiento programado para ${result?.lead?.fullName ?? "el lead"}.`;
    case "ADD_LEAD_NOTE":
    case "ADD_NOTE":
      return `Nota agregada a ${result?.fullName ?? result?.lead?.fullName ?? "el lead"}.`;
    case "GET_LEAD_NOTES":
      return result.summaryText ?? "No hay notas registradas para este lead.";
    case "GET_ALLOWED_TRANSITIONS":
      return result.replyText ?? "Consulta de transiciones completada.";
    case "RESCHEDULE_APPOINTMENT":
      return `Cita reprogramada para ${result?.lead?.fullName ?? "el lead"}.`;
    default:
      return "Solicitud completada.";
  }
}

/**
 * @param {{ userId: string, userName?: string, message: string }} input
 */
export async function processAssistantChat({ userId, userName, message }) {
  if (!env.assistantEnabled) {
    throw new AppError(
      "El asistente IA está deshabilitado para esta instalación.",
      403
    );
  }

  const text = String(message ?? "").trim();
  if (!text) {
    throw new AppError("El mensaje no puede estar vacío.", 400);
  }
  if (text.length > 2000) {
    throw new AppError("El mensaje es demasiado largo (máximo 2000 caracteres).", 400);
  }

  if (isLeadConversationCancelMessage(text)) {
    await clearAssistantContext(userId);
    const cancel = cancelLeadConversation(userId);
    if (cancel.reply) {
      await logAssistantChatUsage({
        userId,
        userName,
        interpretation: { action: "CREATE_LEAD_CONVERSATION", cancelled: true },
        messagePreview: text.slice(0, 200)
      });
      return buildConversationChatResponse(cancel);
    }
  }

  if (hasActiveLeadConversation(userId)) {
    const turn = await advanceLeadConversation({ userId, message: text });
    if (turn) {
      await logAssistantChatUsage({
        userId,
        userName,
        interpretation: {
          action: turn.action,
          step: turn.step ?? null,
          conversationActive: turn.conversationActive ?? false
        },
        messagePreview: text.slice(0, 200)
      });
      return buildConversationChatResponse(turn);
    }
  }

  const activeContext = await getActiveAssistantContext(userId);

  // TODO: remove — log temporal para depurar contexto activo
  console.log("[assistant-context] active pendingAction:", activeContext?.pendingAction ?? null);

  if (!activeContext) {
    if (isStandaloneSpanishStatusMessage(text)) {
      return {
        interpretation: { action: "CLARIFY", clarification: NO_PENDING_CONTEXT_REPLY },
        executed: false,
        result: null,
        reply: NO_PENDING_CONTEXT_REPLY
      };
    }
    if (resolveMessageRefinement(text)) {
      return {
        interpretation: { action: "CLARIFY", clarification: NO_SELECTED_MESSAGE_REPLY },
        executed: false,
        result: null,
        reply: NO_SELECTED_MESSAGE_REPLY
      };
    }
  } else {
    let followUpInterpretation = buildInterpretationFromAssistantContext(activeContext, text);

    if (
      !followUpInterpretation &&
      activeContext.pendingAction === PENDING_ACTIONS.MESSAGE_REFINEMENT
    ) {
      const contextMessage = getRefinementContextMessage(activeContext);
      const refinement = resolveMessageRefinement(text);

      // TODO: remove — logs temporales de depuración REFINE
      console.log("[REFINE] message =", text);
      console.log("[REFINE] normalized =", normalizeRefinementText(text));
      console.log("[REFINE] refinement =", refinement);
      console.log("[REFINE] contextMessageLength =", contextMessage.length);
      console.log("[REFINE] pendingAction =", activeContext.pendingAction);

      if (contextMessage && refinement) {
        const metadata = readAssistantContextMetadata(activeContext);
        followUpInterpretation = {
          action: "REFINE_SELECTED_MESSAGE",
          leadId: activeContext.leadId ?? null,
          leadName: activeContext.leadName ?? null,
          refinement,
          originalStyle: metadata.selectedStyle ?? null,
          message: contextMessage
        };
      }
    }

    if (
      !followUpInterpretation &&
      activeContext.pendingAction === PENDING_ACTIONS.MULTIPLE_MESSAGE_SELECTION &&
      activeContext.metadata?.options?.length
    ) {
      const reply = buildMultipleMessageSelectionClarificationReply(activeContext.metadata.options);
      return {
        interpretation: { action: "CLARIFY", clarification: reply, viaContext: true },
        executed: false,
        result: null,
        reply
      };
    }
    if (
      !followUpInterpretation &&
      activeContext.pendingAction === PENDING_ACTIONS.MESSAGE_REFINEMENT &&
      getRefinementContextMessage(activeContext)
    ) {
      const reply = buildMessageRefinementClarificationReply();
      // TODO: remove — instrumentación temporal: origen del CLARIFY de refinamiento
      console.log("[CLARIFY_SOURCE] MESSAGE_REFINEMENT_CLARIFY");
      console.log("[CLARIFY_SOURCE] file =", import.meta.url);
      console.log("[CLARIFY_SOURCE] followUpInterpretation =", followUpInterpretation);
      console.log("[CLARIFY_SOURCE] pendingAction =", activeContext.pendingAction);
      console.log("[CLARIFY_SOURCE] text =", text);
      return {
        interpretation: { action: "CLARIFY", clarification: reply, viaContext: true },
        executed: false,
        result: null,
        reply
      };
    }
    if (
      !followUpInterpretation &&
      activeContext.metadata?.pendingDisambiguation &&
      activeContext.metadata?.candidates?.length
    ) {
      const reply =
        activeContext.pendingAction === "RESUME_LEAD"
          ? buildResumeLeadDisambiguationReply(activeContext.metadata.candidates)
          : activeContext.pendingAction === "SUGGEST_NEXT_ACTION"
            ? buildSuggestNextActionDisambiguationReply(activeContext.metadata.candidates)
            : activeContext.pendingAction === "GENERATE_CONTACT_MESSAGE"
              ? buildGenerateContactMessageDisambiguationReply(activeContext.metadata.candidates)
              : activeContext.pendingAction === "GENERATE_MULTIPLE_CONTACT_MESSAGES"
                ? buildGenerateMultipleContactMessagesDisambiguationReply(
                    activeContext.metadata.candidates
                  )
                : buildAddLeadNoteChoiceReply(activeContext.metadata.candidates);
      return {
        interpretation: { action: "CLARIFY", clarification: reply, viaContext: true },
        executed: false,
        result: null,
        reply
      };
    }
    if (followUpInterpretation) {
      await logAssistantChatUsage({
        userId,
        userName,
        interpretation: { ...followUpInterpretation, viaContext: true },
        messagePreview: text.slice(0, 200)
      });

      const result = await executeAssistantAction({
        interpretation: followUpInterpretation,
        userId,
        userMessage: text
      });

      if (result?.needsClarification) {
        if (result.persistContext) {
          await saveAssistantContext({ userId, ...result.persistContext });
        }
        return {
          interpretation: {
            ...followUpInterpretation,
            action: "CLARIFY",
            clarification: result.clarification
          },
          executed: false,
          result: null,
          reply: result.clarification
        };
      }

      if (result?.needsDisambiguation && result.persistContext) {
        await saveAssistantContext({ userId, ...result.persistContext });
      }

      const executed = !result?.needsDisambiguation;

      if (result?.persistContext) {
        // TODO: remove — log temporal para depurar persistencia de contexto
        console.log(
          "[assistant-context] persisting pendingAction:",
          result.persistContext.pendingAction
        );
        await saveAssistantContext({ userId, ...result.persistContext });
      }

      if (executed && shouldClearContextAfterAction(followUpInterpretation.action)) {
        await clearAssistantContext(userId);
      }

      return {
        interpretation: { ...followUpInterpretation, viaContext: true },
        executed,
        result,
        reply: buildReply({
          interpretation: followUpInterpretation,
          executed,
          result
        })
      };
    }
  }

  const interpretation = await callOpenAiInterpreter(text);

  await logAssistantChatUsage({
    userId,
    userName,
    interpretation,
    messagePreview: text.slice(0, 200)
  });

  if (shouldStartLeadConversation(interpretation)) {
    const turn = await beginLeadConversation(userId, interpretation);
    return buildConversationChatResponse(turn);
  }

  if (interpretation.action === "CLARIFY" || interpretation.action === "UNKNOWN") {
    if (interpretation.action === "CLARIFY") {
      const persistContext = inferPersistContextFromClarify(interpretation);
      if (persistContext) {
        await saveAssistantContext({ userId, ...persistContext });
      }
    }
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

  if (result?.needsClarification) {
    if (result.persistContext) {
      await saveAssistantContext({ userId, ...result.persistContext });
    }
    const clarifyInterpretation = {
      ...interpretation,
      action: "CLARIFY",
      clarification: result.clarification
    };
    return {
      interpretation: clarifyInterpretation,
      executed: false,
      result: null,
      reply: result.clarification
    };
  }

  const executed = !result?.needsDisambiguation;

  if (result?.persistContext) {
    await saveAssistantContext({ userId, ...result.persistContext });
  }

  if (result?.needsDisambiguation) {
    return {
      interpretation,
      executed: false,
      result,
      reply: buildReply({ interpretation, executed: false, result })
    };
  }

  if (executed && shouldClearContextAfterAction(interpretation.action)) {
    await clearAssistantContext(userId);
  }

  return {
    interpretation,
    executed,
    result,
    reply: buildReply({ interpretation, executed, result })
  };
}

export function getAssistantCapabilities() {
  if (!env.assistantEnabled) {
    return {
      enabled: false,
      configured: false,
      message: "Asistente deshabilitado."
    };
  }

  return {
    enabled: true,
    configured: Boolean(env.openaiApiKey),
    model: env.openaiModel,
    supportedActions: ASSISTANT_ACTION_TYPES.filter(
      (a) => !["CLARIFY", "UNKNOWN"].includes(a)
    ),
    architecture: "interpret → validate → existing services → Prisma (via leads.service)"
  };
}

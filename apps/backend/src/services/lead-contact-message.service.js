import { prisma, ActivityType, LeadStatus } from "@crm/database";
import { AppError } from "../utils/app-error.js";
import {
  followUpReasonLabelEs,
  statusChangeTimelineLabelEs
} from "../constants/lead-copy.es.js";
import { calendarDaysFromTodayStart, startOfLocalDay } from "../utils/follow-up-date.js";
import { readNoteTextFromActivity } from "./lead-notes.service.js";
import { formatResumeDate } from "./lead-resume.service.js";

const MAX_NOTES = 5;
const MAX_ACTIVITIES = 10;
const TONE = "PROFESSIONAL_FRIENDLY";

const LEAD_CONTACT_SELECT = {
  id: true,
  leadNumber: true,
  fullName: true,
  status: true,
  followUpReason: true,
  followUpCount: true,
  nextActionDate: true,
  lastActivityAt: true,
  createdAt: true,
  serviceCategory: {
    select: { id: true, name: true, slug: true }
  }
};

function ensureLeadRow(lead) {
  if (!lead) throw new AppError("Lead no encontrado.", 404);
  return lead;
}

function firstName(fullName) {
  const name = String(fullName ?? "").trim().split(/\s+/)[0];
  return name || "Hola";
}

/**
 * @param {object} lead
 * @returns {string|null}
 */
export function resolveLeadServiceName(lead) {
  const name = String(lead?.serviceCategory?.name ?? lead?.service ?? "").trim();
  return name || null;
}

/**
 * Frase natural a partir del nombre real del servicio del lead (sin inferir desde notas).
 * @param {string|null} serviceName
 */
export function buildServiceReference(serviceName) {
  const name = String(serviceName ?? "").trim();
  if (!name) return "nuestros servicios";

  const lower = name.toLowerCase();
  if (/^charla/.test(lower)) return `las ${lower} financieras`;
  if (/contabil/.test(lower)) return `los servicios de ${lower}`;
  if (/invers/.test(lower)) return `las opciones de ${lower}`;

  return `el servicio de ${name}`;
}

/**
 * @param {object} lead
 */
export function buildConversationReference(lead) {
  return buildServiceReference(resolveLeadServiceName(lead));
}

/**
 * @param {string} [message]
 * @param {{ style?: string, isShort?: boolean, isFormal?: boolean, short?: boolean, formal?: boolean }} [interpretation]
 */
export function resolveContactMessagePreferences(message = "", interpretation = {}) {
  const text = String(message ?? "").toLowerCase();

  let style = interpretation.style ? String(interpretation.style).trim().toUpperCase() : null;
  if (style && !["SOFT", "DIRECT", "FRIENDLY"].includes(style)) {
    style = null;
  }

  let isShort =
    interpretation.isShort === true ||
    interpretation.short === true ||
    String(interpretation.isShort ?? "").toLowerCase() === "true";

  let isFormal =
    interpretation.isFormal === true ||
    interpretation.formal === true ||
    String(interpretation.isFormal ?? "").toLowerCase() === "true";

  if (!style) {
    if (/\b(amigable|amistoso|friendly|cálido|cercano)\b/.test(text)) {
      style = "FRIENDLY";
    } else if (/\b(directo|concreto)\b/.test(text)) {
      style = "DIRECT";
    } else if (/\b(suave|soft)\b/.test(text)) {
      style = "SOFT";
    }
  }

  if (!isFormal && /\b(formal|profesional)\b/.test(text)) {
    isFormal = true;
  }

  if (
    !isShort &&
    /\b(corto|breve|más corto|mas corto|versión breve|version breve|redáctalo más corto|redactalo mas corto|haz una versión breve)\b/.test(
      text
    )
  ) {
    isShort = true;
  }

  return { style, isShort, isFormal };
}

/**
 * @param {object} lead
 */
export function resolveContactMessageType(lead) {
  if (lead.status === LeadStatus.NEW || lead.status === LeadStatus.CONTACTED) {
    return "NEW";
  }

  if (lead.status === LeadStatus.SCHEDULED) {
    return "SCHEDULED";
  }

  if (lead.status === LeadStatus.FOLLOW_UP) {
    switch (lead.followUpReason) {
      case "BUSY":
      case "CALL_LATER":
        return "FOLLOW_UP_BUSY";
      case "NO_MONEY":
        return "FOLLOW_UP_NO_MONEY";
      case "THINKING":
      case "NO_RESPONSE":
      case "OTHER":
      default:
        return "FOLLOW_UP_THINKING";
    }
  }

  return "NEW";
}

/**
 * @param {object} lead
 * @param {string} messageType
 */
export function buildContactMessageReasoning(lead, messageType) {
  if (messageType === "FOLLOW_UP_BUSY") {
    return "Lead en seguimiento por falta de disponibilidad.";
  }
  if (messageType === "FOLLOW_UP_NO_MONEY") {
    return "Lead en seguimiento por limitaciones económicas.";
  }
  if (messageType === "FOLLOW_UP_THINKING") {
    if (lead.followUpReason === "NO_RESPONSE") {
      return "Lead sin respuesta reciente; conviene retomar contacto con tono amable.";
    }
    return "Lead evaluando la propuesta; conviene resolver dudas pendientes.";
  }
  if (messageType === "SCHEDULED") {
    return "Lead con cita programada; confirmar asistencia.";
  }
  if (lead.status === LeadStatus.CONTACTED) {
    return "Lead contactado recientemente; mensaje de seguimiento inicial.";
  }
  return "Lead nuevo; primer acercamiento comercial.";
}

function buildGreeting(name) {
  return `Hola ${name}.`;
}

function buildClosing(isFormal, isShort = false) {
  if (isFormal) {
    if (isShort) return "Quedo atento a sus comentarios. Saludos cordiales.";
    return "Quedo atento a sus comentarios.\n\nSaludos cordiales.";
  }
  return "Quedo atento.";
}

/**
 * @param {{ messageType: string, conversationRef: string, isFormal: boolean, style: string|null, appointmentLabel: string|null }} ctx
 */
function buildStyledMiddleContent(ctx) {
  const { messageType, conversationRef, isFormal, style, appointmentLabel } = ctx;
  const ref = conversationRef;
  const tu = !isFormal;

  const busy = {
    DEFAULT: tu
      ? "Quería saber si ya tienes disponibilidad para retomar la conversación y resolver cualquier duda pendiente."
      : "Me permito consultarle si ya dispone de disponibilidad para retomar la conversación y resolver cualquier duda pendiente.",
    SOFT: tu
      ? `Solo quería saludarte y consultar si todavía existe interés en retomar la conversación sobre ${ref}.`
      : `Me permito saludarle y consultarle si todavía existe interés en retomar la conversación sobre ${ref}.`,
    DIRECT: tu
      ? `Quería confirmar si podemos avanzar con la propuesta de ${ref} que conversamos.`
      : `Me permito confirmar si podemos avanzar con la propuesta de ${ref} que conversamos.`,
    FRIENDLY: tu
      ? `Espero que estés muy bien. Quería saber cómo vas y si todavía tiene sentido retomar lo que habíamos conversado sobre ${ref}.`
      : `Espero que se encuentre muy bien. Quisiera saber cómo va y si todavía tiene sentido retomar lo que habíamos conversado sobre ${ref}.`
  };

  const noMoney = {
    DEFAULT: tu
      ? `Espero que te encuentres bien. Quería retomar nuestra conversación sobre ${ref} y saber si la situación cambió y si sigue existiendo interés en avanzar.\n\nSin presión; solo me gustaría estar al tanto por si hay algo en lo que podamos apoyarte.`
      : `Espero que se encuentre bien. Me permito retomar nuestra conversación sobre ${ref} y conocer si la situación cambió y si continúa existiendo interés en avanzar.\n\nSin presión; solo me gustaría estar al tanto por si hay algo en lo que podamos apoyarle.`,
    SOFT: tu
      ? `Solo quería saludarte y saber, sin presión, si la situación sobre ${ref} cambió y si sigue habiendo interés.`
      : `Me permito saludarle y consultarle, sin presión, si la situación sobre ${ref} cambió y si continúa existiendo interés.`,
    DIRECT: tu
      ? `Quería confirmar si hoy existe interés en retomar ${ref} o si prefiere que lo retomemos más adelante.`
      : `Me permito confirmar si hoy existe interés en retomar ${ref} o si prefiere que lo retomemos más adelante.`,
    FRIENDLY: tu
      ? `Espero que estés muy bien. Quería saber cómo vas y si ${ref} sigue siendo una prioridad para ti en este momento.`
      : `Espero que se encuentre bien. Quisiera saber cómo va y si ${ref} sigue siendo una prioridad para usted en este momento.`
  };

  const thinking = {
    DEFAULT: tu
      ? `Retomo lo que platicamos sobre ${ref}. Si tienes alguna duda pendiente o quieres revisar detalles antes de decidir, con gusto te apoyo.\n\n¿Te viene bien una breve llamada o mensaje para resolverlo?`
      : `Retomo lo conversado sobre ${ref}. Si tiene alguna duda pendiente o desea revisar detalles antes de decidir, con gusto le apoyo.\n\n¿Le viene bien una breve llamada o mensaje para resolverlo?`,
    SOFT: tu
      ? `Solo quería retomar ${ref} y saber si hay alguna duda que pueda aclarar para ayudarte a decidir con tranquilidad.`
      : `Me permito retomar ${ref} y consultarle si hay alguna duda que pueda aclarar para ayudarle a decidir con tranquilidad.`,
    DIRECT: tu
      ? `Quería confirmar si podemos resolver las dudas pendientes sobre ${ref} y definir el siguiente paso.`
      : `Me permito confirmar si podemos resolver las dudas pendientes sobre ${ref} y definir el siguiente paso.`,
    FRIENDLY: tu
      ? `Espero que estés muy bien. Quería saber si todavía tiene sentido retomar ${ref} y si puedo ayudarte con alguna duda.`
      : `Espero que se encuentre bien. Quisiera saber si todavía tiene sentido retomar ${ref} y si puedo ayudarle con alguna duda.`
  };

  const scheduled = {
    DEFAULT: appointmentLabel
      ? tu
        ? `Te escribo para confirmar nuestra cita del ${appointmentLabel} sobre ${ref}.\n\n¿Sigues disponible en ese horario? Avísame si necesitas reprogramar.`
        : `Me permito confirmar nuestra cita del ${appointmentLabel} relacionada con ${ref}.\n\n¿Sigue disponible en ese horario? Avíseme si necesita reprogramar.`
      : tu
        ? `Te escribo para confirmar nuestra cita sobre ${ref}.\n\n¿Sigues disponible en ese horario? Avísame si necesitas reprogramar.`
        : `Me permito confirmar nuestra cita relacionada con ${ref}.\n\n¿Sigue disponible en ese horario? Avíseme si necesita reprogramar.`,
    SOFT: appointmentLabel
      ? tu
        ? `Solo quería confirmar contigo la cita del ${appointmentLabel} sobre ${ref}.`
        : `Me permito confirmar con usted la cita del ${appointmentLabel} sobre ${ref}.`
      : tu
        ? `Solo quería confirmar contigo la cita sobre ${ref}.`
        : `Me permito confirmar con usted la cita sobre ${ref}.`,
    DIRECT: appointmentLabel
      ? tu
        ? `Quería confirmar si mantenemos la cita del ${appointmentLabel} sobre ${ref}.`
        : `Me permito confirmar si mantenemos la cita del ${appointmentLabel} sobre ${ref}.`
      : tu
        ? `Quería confirmar si mantenemos la cita sobre ${ref}.`
        : `Me permito confirmar si mantenemos la cita sobre ${ref}.`,
    FRIENDLY: appointmentLabel
      ? tu
        ? `Espero que estés muy bien. Quería confirmar contigo la cita del ${appointmentLabel} sobre ${ref}.`
        : `Espero que se encuentre bien. Quisiera confirmar con usted la cita del ${appointmentLabel} sobre ${ref}.`
      : tu
        ? `Espero que estés muy bien. Quería confirmar contigo la cita sobre ${ref}.`
        : `Espero que se encuentre bien. Quisiera confirmar con usted la cita sobre ${ref}.`
  };

  const newLead = {
    DEFAULT: tu
      ? `Te escribo porque mostraste interés en ${ref}. Me gustaría conocerte mejor y contarte cómo podemos apoyarte.\n\n¿Tendrías unos minutos esta semana para platicar?`
      : `Me permito contactarle porque mostró interés en ${ref}. Me gustaría conocerle mejor y contarle cómo podemos apoyarle.\n\n¿Tendría unos minutos esta semana para conversar?`,
    SOFT: tu
      ? `Solo quería saludarte y saber si todavía te interesa conocer más sobre ${ref}.`
      : `Me permito saludarle y consultarle si todavía le interesa conocer más sobre ${ref}.`,
    DIRECT: tu
      ? `Quería confirmar si podemos agendar una breve conversación sobre ${ref}.`
      : `Me permito confirmar si podemos agendar una breve conversación sobre ${ref}.`,
    FRIENDLY: tu
      ? `Espero que estés muy bien. Quería saber si todavía te interesa ${ref} y cómo podemos apoyarte.`
      : `Espero que se encuentre bien. Quisiera saber si todavía le interesa ${ref} y cómo podemos apoyarle.`
  };

  const styleKey = style ?? "DEFAULT";
  const pick = (map) => map[styleKey] ?? map.DEFAULT;

  switch (messageType) {
    case "FOLLOW_UP_BUSY":
      return pick(busy);
    case "FOLLOW_UP_NO_MONEY":
      return pick(noMoney);
    case "FOLLOW_UP_THINKING":
      return pick(thinking);
    case "SCHEDULED":
      return pick(scheduled);
    case "NEW":
    default:
      return pick(newLead);
  }
}

function buildDefaultLegacyBody({ name, conversationRef, messageType, appointmentLabel }) {
  switch (messageType) {
    case "FOLLOW_UP_BUSY":
      return [
        `Hola ${name}.`,
        "",
        `Hace unos días conversamos sobre ${conversationRef}.`,
        "",
        "Quería saber si ya tienes disponibilidad para retomar la conversación y resolver cualquier duda pendiente.",
        "",
        "Quedo atento."
      ].join("\n");

    case "FOLLOW_UP_NO_MONEY":
      return [
        `Hola ${name}.`,
        "",
        `Espero que te encuentres bien. Quería retomar nuestra conversación sobre ${conversationRef} y saber si la situación cambió y si sigue existiendo interés en avanzar.`,
        "",
        "Sin presión; solo me gustaría estar al tanto por si hay algo en lo que podamos apoyarte.",
        "",
        "Quedo atento."
      ].join("\n");

    case "FOLLOW_UP_THINKING":
      return [
        `Hola ${name}.`,
        "",
        `Retomo lo que platicamos sobre ${conversationRef}. Si tienes alguna duda pendiente o quieres revisar detalles antes de decidir, con gusto te apoyo.`,
        "",
        "¿Te viene bien una breve llamada o mensaje para resolverlo?",
        "",
        "Quedo atento."
      ].join("\n");

    case "SCHEDULED":
      return [
        `Hola ${name}.`,
        "",
        appointmentLabel
          ? `Te escribo para confirmar nuestra cita del ${appointmentLabel} sobre ${conversationRef}.`
          : `Te escribo para confirmar nuestra cita sobre ${conversationRef}.`,
        "",
        "¿Sigues disponible en ese horario? Avísame si necesitas reprogramar.",
        "",
        "Quedo atento."
      ].join("\n");

    case "NEW":
    default:
      return [
        `Hola ${name}.`,
        "",
        `Te escribo porque mostraste interés en ${conversationRef}. Me gustaría conocerte mejor y contarte cómo podemos apoyarte.`,
        "",
        "¿Tendrías unos minutos esta semana para platicar?",
        "",
        "Quedo atento."
      ].join("\n");
  }
}

function buildShortBody({ name, conversationRef, messageType, isFormal, style, appointmentLabel }) {
  const greeting = buildGreeting(name);
  const closing = buildClosing(isFormal, true);

  let middle;
  if (messageType === "FOLLOW_UP_BUSY") {
    middle = isFormal
      ? `Me permito consultarle si ya dispone de disponibilidad para retomar nuestra conversación sobre ${conversationRef}.`
      : style === "SOFT"
        ? `Solo quería consultar si todavía existe interés en retomar nuestra conversación sobre ${conversationRef}.`
        : style === "DIRECT"
          ? `Quería confirmar si podemos avanzar con la propuesta de ${conversationRef} que conversamos.`
          : style === "FRIENDLY"
            ? `Espero que estés muy bien. Quería saber si todavía tiene sentido retomar nuestra conversación sobre ${conversationRef}.`
            : `Quería saber si ya tienes disponibilidad para retomar nuestra conversación sobre ${conversationRef}.`;
  } else if (messageType === "FOLLOW_UP_NO_MONEY") {
    middle = isFormal
      ? `Me permito retomar nuestra conversación sobre ${conversationRef} y conocer si la situación cambió.`
      : `Quería retomar nuestra conversación sobre ${conversationRef} y saber si la situación cambió.`;
  } else if (messageType === "FOLLOW_UP_THINKING") {
    middle = isFormal
      ? `Me permito retomar ${conversationRef} y consultarle si hay dudas pendientes que pueda aclarar.`
      : `Quería retomar ${conversationRef} y saber si hay dudas pendientes que pueda aclarar.`;
  } else if (messageType === "SCHEDULED") {
    middle = appointmentLabel
      ? isFormal
        ? `Me permito confirmar la cita del ${appointmentLabel} sobre ${conversationRef}.`
        : `Quería confirmar la cita del ${appointmentLabel} sobre ${conversationRef}.`
      : isFormal
        ? `Me permito confirmar la cita sobre ${conversationRef}.`
        : `Quería confirmar la cita sobre ${conversationRef}.`;
  } else {
    middle = isFormal
      ? `Me permito contactarle por su interés en ${conversationRef}.`
      : `Te escribo por tu interés en ${conversationRef}.`;
  }

  return [greeting, "", middle, "", closing].join("\n");
}

function buildFormalBody({ name, conversationRef, messageType, appointmentLabel }) {
  const greeting = buildGreeting(name);
  const closing = buildClosing(true);

  let intro;
  let body;

  if (messageType === "FOLLOW_UP_BUSY") {
    intro = "Espero que se encuentre bien.";
    body = `Me permito darle seguimiento a nuestra conversación anterior relacionada con ${conversationRef} para conocer si continúa existiendo interés en avanzar.`;
  } else if (messageType === "FOLLOW_UP_NO_MONEY") {
    intro = "Espero que se encuentre bien.";
    body = `Me permito retomar nuestra conversación sobre ${conversationRef} y conocer si la situación cambió y si continúa existiendo interés en avanzar.`;
  } else if (messageType === "FOLLOW_UP_THINKING") {
    intro = "Espero que se encuentre bien.";
    body = `Me permito retomar lo conversado sobre ${conversationRef} y ofrecerle apoyo para resolver cualquier duda pendiente.`;
  } else if (messageType === "SCHEDULED") {
    intro = "Espero que se encuentre bien.";
    body = appointmentLabel
      ? `Me permito confirmar nuestra cita del ${appointmentLabel} relacionada con ${conversationRef}.`
      : `Me permito confirmar nuestra cita relacionada con ${conversationRef}.`;
  } else {
    intro = "Espero que se encuentre bien.";
    body = `Me permito contactarle por su interés en ${conversationRef} y conocer si desea continuar la conversación.`;
  }

  return [greeting, "", intro, "", body, "", closing].join("\n");
}

/**
 * @param {{ lead: object, notes: Array<{ text: string }>, messageType: string, style?: string|null, isShort?: boolean, isFormal?: boolean }} params
 */
export function buildContactMessageBody({
  lead,
  notes: _notes,
  messageType,
  style = null,
  isShort = false,
  isFormal = false
}) {
  const name = firstName(lead.fullName);
  const conversationRef = buildConversationReference(lead);
  const appointmentLabel = lead.nextActionDate ? formatResumeDate(lead.nextActionDate) : null;

  if (!style && !isShort && !isFormal) {
    return buildDefaultLegacyBody({ name, conversationRef, messageType, appointmentLabel });
  }

  if (isShort) {
    return buildShortBody({ name, conversationRef, messageType, isFormal, style, appointmentLabel });
  }

  if (isFormal && !style) {
    return buildFormalBody({ name, conversationRef, messageType, appointmentLabel });
  }

  const greeting = buildGreeting(name);
  const closing = buildClosing(isFormal);
  const middle = buildStyledMiddleContent({
    messageType,
    conversationRef,
    isFormal,
    style,
    appointmentLabel
  });

  const intro =
    isFormal && messageType === "FOLLOW_UP_BUSY"
      ? "Espero que se encuentre bien."
      : !isFormal && messageType === "FOLLOW_UP_BUSY" && !style
        ? `Hace unos días conversamos sobre ${conversationRef}.`
        : null;

  const parts = [greeting];
  if (intro) parts.push("", intro);
  parts.push("", middle, "", closing);
  return parts.join("\n");
}

/**
 * @param {object} result
 */
export function formatContactMessageText(result) {
  const lines = ["Mensaje sugerido", "", result.message];
  if (result.reasoning) {
    lines.push("", result.reasoning);
  }
  return lines.join("\n").trim();
}

export function buildGenerateContactMessageDisambiguationReply(candidates) {
  const list = (candidates ?? []).map((c, i) => `${i + 1}. ${c.fullName}`);
  if (list.length === 0) {
    return "Encontré varias coincidencias. Indica el nombre completo del lead.";
  }
  return `Encontré varias coincidencias:\n\n${list.join("\n")}\n\n¿Para cuál deseas generar el mensaje?`;
}

export function buildGenerateMultipleContactMessagesDisambiguationReply(candidates) {
  const list = (candidates ?? []).map((c, i) => `${i + 1}. ${c.fullName}`);
  if (list.length === 0) {
    return "Encontré varias coincidencias. Indica el nombre completo del lead.";
  }
  return `Encontré varias coincidencias:\n\n${list.join("\n")}\n\n¿Para cuál deseas generar las opciones de mensaje?`;
}

export const MULTIPLE_CONTACT_STYLE_OPTIONS = [
  {
    style: "FRIENDLY",
    label: "Amigable",
    buildOptions: { style: "FRIENDLY", isFormal: false, isShort: false }
  },
  {
    style: "DIRECT",
    label: "Directa",
    buildOptions: { style: "DIRECT", isFormal: false, isShort: false }
  },
  {
    style: "FORMAL",
    label: "Formal",
    buildOptions: { style: null, isFormal: true, isShort: false }
  }
];

export function getMessageOptionStyleLabel(style) {
  return MULTIPLE_CONTACT_STYLE_OPTIONS.find((row) => row.style === style)?.label ?? style;
}

/**
 * @param {string} message
 * @param {Array<{ index: number, style: string, message: string, label?: string }>} options
 */
export function resolveSelectedMessageOption(message, options = []) {
  if (!options.length) return null;

  const text = String(message ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");

  const numberPatterns = [
    { index: 1, re: /\b(opci[oó]n\s+)?1\b|\bprimera\b|\b1ra\b/ },
    { index: 2, re: /\b(opci[oó]n\s+)?2\b|\bsegunda\b|\b2da\b/ },
    { index: 3, re: /\b(opci[oó]n\s+)?3\b|\btercera\b|\b3ra\b/ }
  ];

  for (const { index, re } of numberPatterns) {
    if (re.test(text)) {
      return options.find((option) => option.index === index) ?? options[index - 1] ?? null;
    }
  }

  const stylePatterns = [
    { style: "FRIENDLY", re: /\b(amigable|amistosa|cercana|friendly)\b/ },
    { style: "DIRECT", re: /\b(directa|directo|concreta|concreto)\b/ },
    { style: "FORMAL", re: /\b(formal|profesional)\b/ }
  ];

  for (const { style, re } of stylePatterns) {
    if (re.test(text)) {
      return options.find((option) => option.style === style) ?? null;
    }
  }

  return null;
}

/**
 * @param {Array<{ index: number, label?: string, style: string }>} [options]
 */
export function buildMultipleMessageSelectionClarificationReply(options = []) {
  if (options.length === 0) {
    return "Indica cuál opción prefieres: 1, 2 o 3.";
  }

  const list = options.map(
    (option) =>
      `${option.index}. ${option.label ?? getMessageOptionStyleLabel(option.style)}`
  );

  return `Indica cuál opción prefieres:\n\n${list.join("\n")}\n\nPuedes decir, por ejemplo: "opción 2" o "prefiero la formal".`;
}

/**
 * @param {{ fullName?: string|null, selectedIndex: number, selectedStyle: string, message: string }} result
 */
export function formatSelectedMessageOptionText(result) {
  const label = getMessageOptionStyleLabel(result.selectedStyle);
  const lines = [
    "Perfecto.",
    "",
    `Seleccionaste la opción ${result.selectedIndex} (${label}).`,
    "",
    result.message
  ];
  return lines.join("\n").trim();
}

export const NO_SELECTED_MESSAGE_REPLY =
  "No tengo un mensaje seleccionado para modificar. Primero genera o selecciona un mensaje.";

const CLOSING_LINE_PATTERN =
  /^(quedo atento|saludos cordiales|quedo atento a sus comentarios)/i;

function splitMessageParagraphs(message) {
  return String(message ?? "")
    .trim()
    .split(/\n\n+/)
    .filter(Boolean);
}

function isClosingParagraph(paragraph) {
  return CLOSING_LINE_PATTERN.test(String(paragraph).trim());
}

function joinMessageParagraphs(paragraphs) {
  return paragraphs.join("\n\n").trim();
}

function extractBodyTopic(paragraphs) {
  const body = paragraphs.filter((paragraph) => !isClosingParagraph(paragraph)).slice(1);
  const joined = body.join(" ");
  const match = /sobre ([^.]+)/i.exec(joined);
  return match?.[1]?.trim() ?? "nuestra conversación";
}

/**
 * Normaliza texto de refinamiento: minúsculas, sin acentos ni puntuación.
 * @param {string} [message]
 */
export function normalizeRefinementText(message = "") {
  return String(message ?? "")
    .trim()
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, " ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** @param {string} text @param {RegExp[]} patterns */
function matchesRefinementPatterns(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

const REFINEMENT_PATTERN_GROUPS = [
  {
    refinement: "REMOVE_CLOSING",
    patterns: [
      /\bquita(r)?\s+la\s+despedida\b/,
      /\bsin\s+despedida\b/,
      /\belimina(r)?\s+la\s+despedida\b/
    ]
  },
  {
    refinement: "SHORTER",
    patterns: [
      /\bacortala\b/,
      /\bacortarla\b/,
      /\breducela\b/,
      /\breducirla\b/,
      /\b(hazla|hazlo)\s+breve\b/,
      /\bmas\s+breve\b/,
      /\b(hazla|hazlo)\s+mas\s+cort[ao]\b/,
      /\bmas\s+cort[ao]\b/,
      /\bversion\s+cort[ao]\b/,
      /\bversion\s+breve\b/,
      /^(cort[ao]|breve)$/
    ]
  },
  {
    refinement: "FRIENDLIER",
    patterns: [
      /\bmas\s+amigable\b/,
      /\bmas\s+calid[ao]\b/,
      /\bmas\s+cercan[ao]\b/
    ]
  },
  {
    refinement: "FORMAL",
    patterns: [/\bmas\s+formal\b/, /\bmas\s+profesional\b/, /\bmas\s+corporativ[ao]\b/]
  },
  {
    refinement: "DIRECT",
    patterns: [/\bmas\s+direct[ao]\b/, /\bmas\s+concret[ao]\b/]
  },
  {
    refinement: "SOFT",
    patterns: [/\bmas\s+suave\b/, /\bsoft\b/]
  },
  {
    refinement: "ALTERNATIVE",
    patterns: [
      /\botra\s+version\b/,
      /\bdame\s+otra\b/,
      /\breescribela\b/,
      /\breescribirla\b/,
      /\breescribe\b/
    ]
  }
];

/**
 * @param {string} [message]
 */
export function resolveMessageRefinement(message = "") {
  const text = normalizeRefinementText(message);
  if (!text) return null;

  for (const { refinement, patterns } of REFINEMENT_PATTERN_GROUPS) {
    if (matchesRefinementPatterns(text, patterns)) {
      return refinement;
    }
  }

  return null;
}

/**
 * @param {{ message: string, refinement: string, leadName?: string|null }} params
 */
export function refineSelectedMessage({ message, refinement, leadName = null }) {
  const paragraphs = splitMessageParagraphs(message);
  const greeting =
    paragraphs[0] ?? (leadName ? `Hola ${firstName(leadName)}.` : "Hola.");
  const bodyParagraphs = paragraphs.slice(1).filter((paragraph) => !isClosingParagraph(paragraph));
  const closingParagraphs = paragraphs.filter((paragraph) => isClosingParagraph(paragraph));
  const topic = extractBodyTopic(paragraphs);
  const defaultClosing = closingParagraphs.length > 0 ? closingParagraphs : ["Quedo atento."];

  switch (refinement) {
    case "REMOVE_CLOSING":
      return joinMessageParagraphs(paragraphs.filter((paragraph) => !isClosingParagraph(paragraph)));

    case "SHORTER": {
      const brief = `Quería saber si ya tienes disponibilidad para retomar nuestra conversación sobre ${topic}.`;
      return joinMessageParagraphs([greeting, brief, "Quedo atento."]);
    }

    case "FRIENDLIER": {
      const friendlyCore =
        bodyParagraphs.join(" ") ||
        `Quería saber cómo vas y si todavía tiene sentido retomar lo conversado sobre ${topic}.`;
      const friendlyBody = /espero que est/i.test(friendlyCore)
        ? friendlyCore
        : `Espero que estés muy bien. ${friendlyCore}`;
      return joinMessageParagraphs([greeting, friendlyBody.trim(), ...defaultClosing]);
    }

    case "FORMAL": {
      const formalCore = bodyParagraphs
        .join(" ")
        .replace(/\bQuería\b/g, "Me permito consultarle si")
        .replace(/\btienes\b/gi, "tiene")
        .replace(/\btu\b/gi, "su")
        .replace(/\bte\b/gi, "le")
        .trim();

      const formalBody = /espero que se encuentre/i.test(formalCore)
        ? formalCore
        : `Espero que se encuentre bien.\n\n${
            formalCore ||
            `Me permito darle seguimiento a nuestra conversación anterior relacionada con ${topic}.`
          }`;

      return joinMessageParagraphs([
        greeting,
        formalBody,
        "Quedo atento a sus comentarios.",
        "Saludos cordiales."
      ]);
    }

    case "DIRECT":
      return joinMessageParagraphs([
        greeting,
        `Quería confirmar si podemos avanzar con lo conversado sobre ${topic}.`,
        ...defaultClosing
      ]);

    case "SOFT":
      return joinMessageParagraphs([
        greeting,
        `Solo quería saludarte y consultar si todavía existe interés en retomar la conversación sobre ${topic}.`,
        ...defaultClosing
      ]);

    case "ALTERNATIVE": {
      const altBody = `Me gustaría retomar nuestra conversación sobre ${topic} y saber si sigue siendo un buen momento para conversar.`;
      return joinMessageParagraphs([greeting, altBody, ...defaultClosing]);
    }

    default:
      return message;
  }
}

/**
 * @param {{ message: string }} result
 */
export function formatRefinedMessageText(result) {
  return ["Versión refinada", "", result.message].join("\n").trim();
}

export function buildMessageRefinementClarificationReply() {
  return 'Puedes pedirme: "más corta", "más amigable", "más formal", "más directa", "más suave", "quita la despedida" u "otra versión".';
}

/**
 * @param {string} leadId
 */
async function loadLeadContactContext(leadId) {
  const lead = ensureLeadRow(
    await prisma.lead.findUnique({
      where: { id: leadId },
      select: LEAD_CONTACT_SELECT
    })
  );

  const noteActivities = await prisma.activity.findMany({
    where: { leadId, type: ActivityType.NOTE_ADDED },
    orderBy: { createdAt: "desc" },
    take: MAX_NOTES,
    select: {
      id: true,
      description: true,
      metadata: true,
      createdAt: true
    }
  });

  const activities = await prisma.activity.findMany({
    where: { leadId },
    orderBy: { createdAt: "desc" },
    take: MAX_ACTIVITIES,
    select: {
      id: true,
      type: true,
      description: true,
      createdAt: true
    }
  });

  const notes = noteActivities.map((activity) => ({
    id: activity.id,
    text: readNoteTextFromActivity(activity),
    createdAt: activity.createdAt
  }));

  const messageType = resolveContactMessageType(lead);
  const reasoning = buildContactMessageReasoning(lead, messageType);

  return { lead, notes, activities, messageType, reasoning };
}

/**
 * @param {object} lead
 * @param {string} messageType
 * @param {string} reasoning
 * @param {{ notes: Array<{ text: string }>, activities: Array<object> }} counts
 */
function buildLeadContactMetadata(lead, messageType, reasoning, { notes, activities }) {
  const result = {
    leadId: lead.id,
    leadNumber: lead.leadNumber,
    fullName: lead.fullName,
    status: lead.status,
    statusLabel: statusChangeTimelineLabelEs[lead.status] ?? lead.status,
    service: resolveLeadServiceName(lead),
    followUpReason: lead.followUpReason ?? null,
    followUpReasonLabel: lead.followUpReason
      ? followUpReasonLabelEs[lead.followUpReason]
      : null,
    nextActionDate: lead.nextActionDate ? lead.nextActionDate.toISOString() : null,
    nextActionDateLabel: lead.nextActionDate ? formatResumeDate(lead.nextActionDate) : null,
    messageType,
    tone: TONE,
    reasoning,
    notesAnalyzed: notes.length,
    activitiesAnalyzed: activities.length
  };

  if (lead.nextActionDate) {
    const dayOffset = calendarDaysFromTodayStart(startOfLocalDay(lead.nextActionDate));
    if (dayOffset < 0) {
      result.nextActionUrgency = "OVERDUE";
    } else if (dayOffset === 0) {
      result.nextActionUrgency = "TODAY";
    }
  }

  return result;
}

/**
 * @param {object} result
 */
export function formatMultipleContactMessagesText(result) {
  const name = firstName(result.fullName);
  const lines = [`Opciones de mensaje para ${name}`];

  (result.options ?? []).forEach((option, index) => {
    const label =
      MULTIPLE_CONTACT_STYLE_OPTIONS.find((row) => row.style === option.style)?.label ??
      option.style;
    if (index > 0) {
      lines.push("", "---", "");
    }
    lines.push(`Opción ${index + 1} - ${label}`, "", option.message);
  });

  if (result.reasoning) {
    lines.push("", result.reasoning);
  }

  return lines.join("\n").trim();
}

/**
 * @param {string} leadId
 * @param {{ style?: string|null, isShort?: boolean, isFormal?: boolean }} [preferences]
 */
export async function getContactMessageByLeadId(leadId, preferences = {}) {
  const { lead, notes, activities, messageType, reasoning } = await loadLeadContactContext(leadId);
  const prefs = resolveContactMessagePreferences("", preferences);
  const message = buildContactMessageBody({
    lead,
    notes,
    messageType,
    style: prefs.style,
    isShort: prefs.isShort,
    isFormal: prefs.isFormal
  });

  const result = {
    action: "GENERATE_CONTACT_MESSAGE",
    ...buildLeadContactMetadata(lead, messageType, reasoning, { notes, activities }),
    style: prefs.style,
    isShort: prefs.isShort,
    isFormal: prefs.isFormal,
    message
  };

  result.summaryText = formatContactMessageText(result);

  return result;
}

/**
 * @param {{ lead: object, notes: Array<{ text: string }>, messageType: string }} params
 */
export function buildMultipleContactMessageOptions({ lead, notes, messageType }) {
  return MULTIPLE_CONTACT_STYLE_OPTIONS.map(({ style, buildOptions }) => ({
    style,
    message: buildContactMessageBody({
      lead,
      notes,
      messageType,
      ...buildOptions
    })
  }));
}

/**
 * @param {string} leadId
 */
export async function getMultipleContactMessagesByLeadId(leadId) {
  const { lead, notes, activities, messageType, reasoning } = await loadLeadContactContext(leadId);

  const options = buildMultipleContactMessageOptions({ lead, notes, messageType });

  const result = {
    action: "GENERATE_MULTIPLE_CONTACT_MESSAGES",
    ...buildLeadContactMetadata(lead, messageType, reasoning, { notes, activities }),
    options
  };

  result.summaryText = formatMultipleContactMessagesText(result);

  return result;
}

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FollowUpReason, LeadStatus } from "@crm/database";
import { buildInterpretationFromAssistantContext } from "./assistant-context-resolver.service.js";
import {
  buildGenerateContactMessageDisambiguationContext,
  buildGenerateMultipleContactMessagesDisambiguationContext,
  buildMultipleMessageSelectionContext,
  buildMessageRefinementContext,
  PENDING_ACTIONS
} from "./assistant-conversation-context.service.js";
import {
  buildContactMessageBody,
  buildContactMessageReasoning,
  buildConversationReference,
  buildGenerateContactMessageDisambiguationReply,
  buildGenerateMultipleContactMessagesDisambiguationReply,
  buildMultipleContactMessageOptions,
  buildMultipleMessageSelectionClarificationReply,
  buildServiceReference,
  formatContactMessageText,
  formatMultipleContactMessagesText,
  formatSelectedMessageOptionText,
  formatRefinedMessageText,
  refineSelectedMessage,
  normalizeRefinementText,
  resolveMessageRefinement,
  resolveContactMessagePreferences,
  resolveContactMessageType,
  resolveLeadServiceName,
  resolveSelectedMessageOption
} from "./lead-contact-message.service.js";

function lead(overrides = {}) {
  return {
    fullName: "Keylin Perez",
    status: LeadStatus.FOLLOW_UP,
    followUpReason: FollowUpReason.BUSY,
    nextActionDate: new Date("2026-06-07T12:00:00"),
    serviceCategory: { name: "Charlas" },
    ...overrides
  };
}

describe("GENERATE_CONTACT_MESSAGE — servicio del lead", () => {
  it("usa serviceCategory.name del lead", () => {
    assert.equal(resolveLeadServiceName(lead()), "Charlas");
    assert.equal(buildServiceReference("Charlas"), "las charlas financieras");
    assert.equal(buildConversationReference(lead()), "las charlas financieras");
  });

  it("no infiere contabilidad desde notas si el servicio es Charlas", () => {
    const message = buildContactMessageBody({
      lead: lead({ serviceCategory: { name: "Charlas" } }),
      notes: [{ text: "Interesada en servicios de contabilidad para su negocio." }],
      messageType: "FOLLOW_UP_BUSY"
    });

    assert.match(message, /charlas financieras/i);
    assert.doesNotMatch(message, /contabilidad/i);
  });

  it("usa el servicio real Contabilidad cuando corresponde", () => {
    const message = buildContactMessageBody({
      lead: lead({ serviceCategory: { name: "Contabilidad" } }),
      notes: [{ text: "Mencionó charlas en una conversación previa." }],
      messageType: "FOLLOW_UP_BUSY"
    });

    assert.match(message, /servicios de contabilidad/i);
    assert.doesNotMatch(message, /charlas financieras/i);
  });
});

describe("GENERATE_CONTACT_MESSAGE — tipos de mensaje", () => {
  it("FOLLOW_UP + BUSY → FOLLOW_UP_BUSY", () => {
    assert.equal(resolveContactMessageType(lead()), "FOLLOW_UP_BUSY");
  });

  it("FOLLOW_UP + NO_MONEY → FOLLOW_UP_NO_MONEY", () => {
    assert.equal(
      resolveContactMessageType(lead({ followUpReason: FollowUpReason.NO_MONEY })),
      "FOLLOW_UP_NO_MONEY"
    );
  });

  it("FOLLOW_UP + THINKING → FOLLOW_UP_THINKING", () => {
    assert.equal(
      resolveContactMessageType(lead({ followUpReason: FollowUpReason.THINKING })),
      "FOLLOW_UP_THINKING"
    );
  });

  it("NEW → NEW", () => {
    assert.equal(
      resolveContactMessageType(lead({ status: LeadStatus.NEW, followUpReason: null })),
      "NEW"
    );
  });

  it("SCHEDULED → SCHEDULED", () => {
    assert.equal(
      resolveContactMessageType(lead({ status: LeadStatus.SCHEDULED, followUpReason: null })),
      "SCHEDULED"
    );
  });
});

describe("GENERATE_CONTACT_MESSAGE — preferencias", () => {
  it("amigable → FRIENDLY", () => {
    assert.deepEqual(resolveContactMessagePreferences("Genera un mensaje amigable para Keylin"), {
      style: "FRIENDLY",
      isShort: false,
      isFormal: false
    });
  });

  it("formal → isFormal", () => {
    assert.deepEqual(resolveContactMessagePreferences("Genera un mensaje formal para Keylin"), {
      style: null,
      isShort: false,
      isFormal: true
    });
  });

  it("directo → DIRECT", () => {
    assert.deepEqual(resolveContactMessagePreferences("Genera un mensaje directo para Keylin"), {
      style: "DIRECT",
      isShort: false,
      isFormal: false
    });
  });

  it("suave → SOFT", () => {
    assert.deepEqual(resolveContactMessagePreferences("Genera un mensaje suave para Keylin"), {
      style: "SOFT",
      isShort: false,
      isFormal: false
    });
  });

  it("corto → isShort", () => {
    assert.deepEqual(resolveContactMessagePreferences("Genera un mensaje corto para Keylin"), {
      style: null,
      isShort: true,
      isFormal: false
    });
  });

  it("formal y corto", () => {
    assert.deepEqual(
      resolveContactMessagePreferences("Genera un mensaje formal y corto para Keylin"),
      { style: null, isShort: true, isFormal: true }
    );
  });

  it("sin preferencias mantiene defaults", () => {
    assert.deepEqual(resolveContactMessagePreferences("Genera un mensaje para Keylin"), {
      style: null,
      isShort: false,
      isFormal: false
    });
  });
});

describe("GENERATE_CONTACT_MESSAGE — estilos y formatos", () => {
  it("comportamiento legacy sin preferencias", () => {
    const message = buildContactMessageBody({
      lead: lead(),
      notes: [],
      messageType: "FOLLOW_UP_BUSY"
    });

    assert.match(message, /Hola Keylin\./);
    assert.match(message, /Hace unos días conversamos/i);
    assert.match(message, /Quedo atento\./);
  });

  it("FRIENDLY usa tono cercano", () => {
    const message = buildContactMessageBody({
      lead: lead(),
      notes: [],
      messageType: "FOLLOW_UP_BUSY",
      style: "FRIENDLY"
    });

    assert.match(message, /Espero que estés muy bien/i);
  });

  it("SOFT usa tono suave", () => {
    const message = buildContactMessageBody({
      lead: lead(),
      notes: [],
      messageType: "FOLLOW_UP_BUSY",
      style: "SOFT"
    });

    assert.match(message, /Solo quería saludarte/i);
  });

  it("DIRECT es orientado a acción", () => {
    const message = buildContactMessageBody({
      lead: lead(),
      notes: [],
      messageType: "FOLLOW_UP_BUSY",
      style: "DIRECT"
    });

    assert.match(message, /confirmar si podemos avanzar/i);
  });

  it("formal usa Hola y Saludos cordiales", () => {
    const message = buildContactMessageBody({
      lead: lead(),
      notes: [],
      messageType: "FOLLOW_UP_BUSY",
      isFormal: true
    });

    assert.match(message, /Hola Keylin\./);
    assert.match(message, /Saludos cordiales\./);
    assert.match(message, /charlas financieras/i);
    assert.doesNotMatch(message, /Estimado\/a/i);
  });

  it("corto limita a saludo, cuerpo y cierre", () => {
    const message = buildContactMessageBody({
      lead: lead(),
      notes: [],
      messageType: "FOLLOW_UP_BUSY",
      isShort: true
    });

    const paragraphs = message.split("\n\n").filter(Boolean);
    assert.equal(paragraphs.length, 3);
    assert.match(message, /charlas financieras/i);
    assert.match(message, /Quedo atento\./);
  });

  it("formal y corto combinados", () => {
    const message = buildContactMessageBody({
      lead: lead(),
      notes: [],
      messageType: "FOLLOW_UP_BUSY",
      isShort: true,
      isFormal: true
    });

    assert.match(message, /Hola Keylin\./);
    assert.match(message, /Saludos cordiales\./);
    assert.doesNotMatch(message, /Estimado\/a/i);
    const paragraphs = message.split("\n\n").filter(Boolean);
    assert.equal(paragraphs.length, 3);
  });

  it("reasoning para BUSY", () => {
    const reasoning = buildContactMessageReasoning(lead(), "FOLLOW_UP_BUSY");
    assert.match(reasoning, /disponibilidad/i);
  });

  it("formato de respuesta incluye Mensaje sugerido", () => {
    const text = formatContactMessageText({
      message: "Hola Keylin.\n\nQuedo atento.",
      reasoning: "Lead en seguimiento por falta de disponibilidad."
    });

    assert.match(text, /Mensaje sugerido/);
    assert.match(text, /Hola Keylin/);
  });
});

describe("GENERATE_CONTACT_MESSAGE — desambiguación Marielos", () => {
  const candidates = [
    { id: "lead-mp", leadNumber: 4, fullName: "Marielos Perez" },
    { id: "lead-mc", leadNumber: 6, fullName: "Marielos Castro" }
  ];

  it("pregunta para cuál generar el mensaje", () => {
    const reply = buildGenerateContactMessageDisambiguationReply(candidates);
    assert.match(reply, /1\. Marielos Perez/);
    assert.match(reply, /¿Para cuál deseas generar el mensaje\?/);
  });

  it("contexto pendingDisambiguation", () => {
    const ctx = buildGenerateContactMessageDisambiguationContext({
      leadName: "Marielos",
      candidates,
      preferences: { style: "FRIENDLY", isShort: false, isFormal: false }
    });
    assert.equal(ctx.pendingAction, PENDING_ACTIONS.GENERATE_CONTACT_MESSAGE);
    assert.equal(ctx.metadata.messagePreferences.style, "FRIENDLY");
  });

  it("turno 2 conserva preferencias amigables", () => {
    const interpretation = buildInterpretationFromAssistantContext(
      buildGenerateContactMessageDisambiguationContext({
        leadName: "Marielos",
        candidates,
        preferences: { style: "FRIENDLY", isShort: false, isFormal: false }
      }),
      "Marielos Perez"
    );
    assert.equal(interpretation.action, "GENERATE_CONTACT_MESSAGE");
    assert.equal(interpretation.leadId, "lead-mp");
    assert.equal(interpretation.style, "FRIENDLY");
  });
});

describe("GENERATE_CONTACT_MESSAGE — lenguaje neutro", () => {
  const FORBIDDEN_GENDER_PATTERN = /Estimado\/a|Interesado\/a|Cliente\/a|Señor\/a/i;

  const messageTypes = [
    "FOLLOW_UP_BUSY",
    "FOLLOW_UP_NO_MONEY",
    "FOLLOW_UP_THINKING",
    "SCHEDULED",
    "NEW"
  ];

  function leadForMessageType(messageType) {
    switch (messageType) {
      case "NEW":
        return lead({ status: LeadStatus.NEW, followUpReason: null });
      case "SCHEDULED":
        return lead({ status: LeadStatus.SCHEDULED, followUpReason: null });
      case "FOLLOW_UP_NO_MONEY":
        return lead({ followUpReason: FollowUpReason.NO_MONEY });
      case "FOLLOW_UP_THINKING":
        return lead({ followUpReason: FollowUpReason.THINKING });
      default:
        return lead();
    }
  }

  const variants = [
    {},
    { style: "FRIENDLY" },
    { style: "SOFT" },
    { style: "DIRECT" },
    { isFormal: true },
    { isShort: true },
    { isFormal: true, isShort: true },
    { style: "FRIENDLY", isFormal: true },
    { style: "DIRECT", isShort: true }
  ];

  for (const messageType of messageTypes) {
    for (const options of variants) {
      it(`${messageType} ${JSON.stringify(options)} sin referencias de género`, () => {
        const message = buildContactMessageBody({
          lead: leadForMessageType(messageType),
          notes: [],
          messageType,
          ...options
        });

        assert.match(message, /Hola Keylin\./);
        assert.doesNotMatch(message, FORBIDDEN_GENDER_PATTERN);
      });
    }
  }

  it("formal para Keylin sigue el saludo neutro", () => {
    const message = buildContactMessageBody({
      lead: lead(),
      notes: [],
      messageType: "FOLLOW_UP_BUSY",
      isFormal: true
    });

    assert.match(message, /^Hola Keylin\./m);
    assert.match(message, /Espero que se encuentre bien\./);
    assert.match(message, /charlas financieras/i);
  });

  it("amigable para Keylin usa Hola", () => {
    const message = buildContactMessageBody({
      lead: lead(),
      notes: [],
      messageType: "FOLLOW_UP_BUSY",
      style: "FRIENDLY"
    });

    assert.match(message, /^Hola Keylin\./m);
    assert.match(message, /Espero que estés muy bien/i);
    assert.doesNotMatch(message, FORBIDDEN_GENDER_PATTERN);
  });
});

describe("GENERATE_CONTACT_MESSAGE — intenciones", () => {
  it("acción esperada", () => {
    assert.equal(
      { action: "GENERATE_CONTACT_MESSAGE" }.action,
      "GENERATE_CONTACT_MESSAGE"
    );
  });
});

describe("GENERATE_MULTIPLE_CONTACT_MESSAGES — opciones", () => {
  it("genera FRIENDLY, DIRECT y FORMAL", () => {
    const options = buildMultipleContactMessageOptions({
      lead: lead(),
      notes: [],
      messageType: "FOLLOW_UP_BUSY"
    });

    assert.equal(options.length, 3);
    assert.deepEqual(
      options.map((option) => option.style),
      ["FRIENDLY", "DIRECT", "FORMAL"]
    );
    for (const option of options) {
      assert.match(option.message, /Hola Keylin\./);
      assert.ok(option.message.length > 20);
    }
  });

  it("formato agrupa tres opciones con separadores", () => {
    const text = formatMultipleContactMessagesText({
      fullName: "Keylin Perez",
      reasoning: "Lead en seguimiento por falta de disponibilidad.",
      options: [
        { style: "FRIENDLY", message: "Hola Keylin.\n\nMensaje amigable." },
        { style: "DIRECT", message: "Hola Keylin.\n\nMensaje directo." },
        { style: "FORMAL", message: "Hola Keylin.\n\nMensaje formal." }
      ]
    });

    assert.match(text, /Opciones de mensaje para Keylin/);
    assert.match(text, /Opción 1 - Amigable/);
    assert.match(text, /Opción 2 - Directa/);
    assert.match(text, /Opción 3 - Formal/);
    assert.match(text, /---/);
    assert.match(text, /disponibilidad/i);
  });

  it("cada estilo produce redacción distinta", () => {
    const options = buildMultipleContactMessageOptions({
      lead: lead(),
      notes: [],
      messageType: "FOLLOW_UP_BUSY"
    });

    const friendly = options.find((option) => option.style === "FRIENDLY")?.message ?? "";
    const direct = options.find((option) => option.style === "DIRECT")?.message ?? "";
    const formal = options.find((option) => option.style === "FORMAL")?.message ?? "";

    assert.match(friendly, /Espero que estés muy bien/i);
    assert.match(direct, /confirmar si podemos avanzar/i);
    assert.match(formal, /Saludos cordiales\./);
    assert.notEqual(friendly, direct);
    assert.notEqual(direct, formal);
  });
});

describe("GENERATE_MULTIPLE_CONTACT_MESSAGES — desambiguación Marielos", () => {
  const candidates = [
    { id: "lead-mp", leadNumber: 4, fullName: "Marielos Perez" },
    { id: "lead-mc", leadNumber: 6, fullName: "Marielos Castro" }
  ];

  it("pregunta para cuál generar las opciones", () => {
    const reply = buildGenerateMultipleContactMessagesDisambiguationReply(candidates);
    assert.match(reply, /1\. Marielos Perez/);
    assert.match(reply, /¿Para cuál deseas generar las opciones de mensaje\?/);
  });

  it("turno 2: Marielos Perez → GENERATE_MULTIPLE_CONTACT_MESSAGES", () => {
    const interpretation = buildInterpretationFromAssistantContext(
      buildGenerateMultipleContactMessagesDisambiguationContext({
        leadName: "Marielos",
        candidates
      }),
      "Marielos Perez"
    );
    assert.equal(interpretation.action, "GENERATE_MULTIPLE_CONTACT_MESSAGES");
    assert.equal(interpretation.leadId, "lead-mp");
  });
});

describe("GENERATE_MULTIPLE_CONTACT_MESSAGES — intenciones", () => {
  it("acción esperada", () => {
    assert.equal(
      { action: "GENERATE_MULTIPLE_CONTACT_MESSAGES" }.action,
      "GENERATE_MULTIPLE_CONTACT_MESSAGES"
    );
  });
});

describe("SELECT_GENERATED_MESSAGE_OPTION — selección conversacional", () => {
  const storedOptions = [
    { index: 1, style: "FRIENDLY", label: "Amigable", message: "Mensaje amigable." },
    { index: 2, style: "DIRECT", label: "Directa", message: "Mensaje directo." },
    { index: 3, style: "FORMAL", label: "Formal", message: "Mensaje formal." }
  ];

  it("me gusta la opción 2 → DIRECT", () => {
    const selected = resolveSelectedMessageOption("Me gusta la opción 2.", storedOptions);
    assert.equal(selected?.index, 2);
    assert.equal(selected?.style, "DIRECT");
  });

  it("la tercera → FORMAL", () => {
    const selected = resolveSelectedMessageOption("La tercera.", storedOptions);
    assert.equal(selected?.index, 3);
    assert.equal(selected?.style, "FORMAL");
  });

  it("prefiero la formal → FORMAL", () => {
    const selected = resolveSelectedMessageOption("Prefiero la formal.", storedOptions);
    assert.equal(selected?.style, "FORMAL");
  });

  it("usa la amigable → FRIENDLY", () => {
    const selected = resolveSelectedMessageOption("Usa la amigable.", storedOptions);
    assert.equal(selected?.style, "FRIENDLY");
  });

  it("formato de respuesta incluye opción seleccionada", () => {
    const text = formatSelectedMessageOptionText({
      fullName: "Keylin Perez",
      selectedIndex: 2,
      selectedStyle: "DIRECT",
      message: "Hola Keylin.\n\nQuería confirmar si podemos avanzar.\n\nQuedo atento."
    });

    assert.match(text, /Perfecto\./);
    assert.match(text, /Seleccionaste la opción 2 \(Directa\)/);
    assert.match(text, /Hola Keylin\./);
  });

  it("contexto MULTIPLE_MESSAGE_SELECTION resuelve selección", () => {
    const context = buildMultipleMessageSelectionContext({
      leadId: "lead-keylin",
      leadName: "Keylin Perez",
      options: storedOptions
    });

    const interpretation = buildInterpretationFromAssistantContext(
      context,
      "Quedémonos con la amigable."
    );

    assert.equal(interpretation.action, "SELECT_GENERATED_MESSAGE_OPTION");
    assert.equal(interpretation.selectedIndex, 1);
    assert.equal(interpretation.selectedStyle, "FRIENDLY");
    assert.equal(interpretation.message, "Mensaje amigable.");
  });

  it("clarificación lista opciones disponibles", () => {
    const reply = buildMultipleMessageSelectionClarificationReply(storedOptions);
    assert.match(reply, /1\. Amigable/);
    assert.match(reply, /2\. Directa/);
    assert.match(reply, /3\. Formal/);
  });
});

describe("REFINE_SELECTED_MESSAGE — refinamiento conversacional", () => {
  const directMessage =
    "Hola Keylin.\n\nQuería confirmar si podemos avanzar con lo conversado sobre charlas financieras.\n\nQuedo atento.";

  describe("normalizeRefinementText", () => {
    it("elimina acentos, puntuación y espacios extra", () => {
      assert.equal(normalizeRefinementText("  Hazla más corta.  "), "hazla mas corta");
      assert.equal(normalizeRefinementText("«más corta»"), "mas corta");
      assert.equal(normalizeRefinementText("MÁS CORTA!!!"), "mas corta");
    });
  });

  describe("resolveMessageRefinement — SHORTER", () => {
    for (const phrase of [
      "más corta",
      "Hazla más corta.",
      "más breve",
      "acórtala",
      "hazla breve",
      "versión corta",
      "redúcela",
      "  más   corta  ",
      "MAS CORTA",
      "corta"
    ]) {
      it(`"${phrase}" → SHORTER`, () => {
        assert.equal(resolveMessageRefinement(phrase), "SHORTER");
      });
    }
  });

  it("resolveMessageRefinement detecta otras intenciones", () => {
    assert.equal(resolveMessageRefinement("Más amigable."), "FRIENDLIER");
    assert.equal(resolveMessageRefinement("Más formal."), "FORMAL");
    assert.equal(resolveMessageRefinement("Más directa."), "DIRECT");
    assert.equal(resolveMessageRefinement("Más suave."), "SOFT");
    assert.equal(resolveMessageRefinement("Quita la despedida."), "REMOVE_CLOSING");
    assert.equal(resolveMessageRefinement("Dame otra versión."), "ALTERNATIVE");
  });

  it("contexto MESSAGE_REFINEMENT resuelve más corta", () => {
    const context = buildMessageRefinementContext({
      leadId: "lead-keylin",
      leadName: "Keylin Perez",
      selectedStyle: "DIRECT",
      message: directMessage
    });

    for (const phrase of ["más corta", "Hazla más corta.", "más breve", "acórtala"]) {
      const interpretation = buildInterpretationFromAssistantContext(context, phrase);
      assert.equal(interpretation.action, "REFINE_SELECTED_MESSAGE", phrase);
      assert.equal(interpretation.refinement, "SHORTER", phrase);
    }
  });

  it("flujo completo: seleccionar → acortar → amigable → quitar despedida → alternativa", () => {
    const selectionContext = buildMultipleMessageSelectionContext({
      leadId: "lead-keylin",
      leadName: "Keylin Perez",
      options: [
        { style: "FRIENDLY", message: "Mensaje amigable.", label: "Amigable" },
        { style: "DIRECT", message: directMessage, label: "Directa" },
        { style: "FORMAL", message: "Mensaje formal.", label: "Formal" }
      ]
    });

    const selectInterpretation = buildInterpretationFromAssistantContext(
      selectionContext,
      "Me gusta la opción 2."
    );
    assert.equal(selectInterpretation.selectedStyle, "DIRECT");

    let refinementContext = buildMessageRefinementContext({
      leadId: selectInterpretation.leadId,
      leadName: selectInterpretation.leadName,
      selectedStyle: selectInterpretation.selectedStyle,
      message: selectInterpretation.message
    });
    assert.equal(refinementContext.pendingAction, PENDING_ACTIONS.MESSAGE_REFINEMENT);

    const shorterInterpretation = buildInterpretationFromAssistantContext(
      refinementContext,
      "Hazla más corta."
    );
    assert.equal(shorterInterpretation.refinement, "SHORTER");

    let currentMessage = refineSelectedMessage({
      message: shorterInterpretation.message,
      refinement: shorterInterpretation.refinement,
      leadName: shorterInterpretation.leadName
    });
    assert.match(currentMessage, /disponibilidad/);
    assert.match(formatRefinedMessageText({ message: currentMessage }), /Versión refinada/);

    refinementContext = buildMessageRefinementContext({
      leadId: shorterInterpretation.leadId,
      leadName: shorterInterpretation.leadName,
      selectedStyle: shorterInterpretation.originalStyle,
      message: currentMessage
    });

    const friendlierInterpretation = buildInterpretationFromAssistantContext(
      refinementContext,
      "Más amigable."
    );
    currentMessage = refineSelectedMessage({
      message: friendlierInterpretation.message,
      refinement: friendlierInterpretation.refinement,
      leadName: friendlierInterpretation.leadName
    });
    assert.match(currentMessage, /Espero que estés muy bien/);

    refinementContext = buildMessageRefinementContext({
      leadId: friendlierInterpretation.leadId,
      leadName: friendlierInterpretation.leadName,
      selectedStyle: friendlierInterpretation.originalStyle,
      message: currentMessage
    });

    const removeClosingInterpretation = buildInterpretationFromAssistantContext(
      refinementContext,
      "Quita la despedida."
    );
    currentMessage = refineSelectedMessage({
      message: removeClosingInterpretation.message,
      refinement: removeClosingInterpretation.refinement,
      leadName: removeClosingInterpretation.leadName
    });
    assert.doesNotMatch(currentMessage, /Quedo atento/);

    refinementContext = buildMessageRefinementContext({
      leadId: removeClosingInterpretation.leadId,
      leadName: removeClosingInterpretation.leadName,
      selectedStyle: removeClosingInterpretation.originalStyle,
      message: currentMessage
    });

    const alternativeInterpretation = buildInterpretationFromAssistantContext(
      refinementContext,
      "Dame otra versión."
    );
    currentMessage = refineSelectedMessage({
      message: alternativeInterpretation.message,
      refinement: alternativeInterpretation.refinement,
      leadName: alternativeInterpretation.leadName
    });
    assert.match(currentMessage, /Me gustaría retomar nuestra conversación/);
  });
});

import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env.js';

const VALID_CLASSIFICATIONS = ['interested', 'objection', 'question', 'not_interested', 'other'];

export async function classifyAndSuggest({ lead, text }) {
  if (!env.inboundClassifier.enabled || !env.anthropic.apiKey) {
    return null;
  }

  const client = new Anthropic({ apiKey: env.anthropic.apiKey });

  const systemPrompt = `Eres un asistente de CRM para VR Consultorías, una consultora de inversiones en Costa Rica.

Tu tarea: analizar el mensaje de un lead y devolver un JSON con:
- classification: uno de [interested, objection, question, not_interested, other]
- intent: descripción corta en inglés (ej: "asks_about_returns", "scheduling_meeting")
- suggestedReply: respuesta sugerida en español costarricense, cálida y profesional (máx 250 caracteres)
- confidence: número entre 0 y 1

Responde SOLO con JSON válido, sin markdown, sin texto extra.`;

  const userPrompt = `<lead_name>${lead.fullName ?? ''}</lead_name>
<lead_status>${lead.status}</lead_status>
<follow_up_reason>${lead.followUpReason ?? 'none'}</follow_up_reason>
<inbound_message>${text}</inbound_message>`;

  const sanitize = (str) => String(str ?? '').replace(/[\x00-\x1F\x7F]/g, '').trim();

  try {
    const response = await client.messages.create({
      model: env.inboundClassifier.model,
      max_tokens: 512,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    });

    const raw = response.content[0]?.text ?? '';
    const parsed = JSON.parse(raw);

    return {
      classification: VALID_CLASSIFICATIONS.includes(parsed.classification) ? parsed.classification : 'other',
      intent: sanitize(parsed.intent).slice(0, 100),
      suggestedReply: sanitize(parsed.suggestedReply).slice(0, 300),
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence ?? 0.5))),
      model: env.inboundClassifier.model,
    };
  } catch (err) {
    console.error('[inbound-classifier] error:', err.message);
    return null;
  }
}

/**
 * templates.es.js — Spanish WhatsApp message template catalog.
 *
 * Templates are keyed by (status, followUpReason). Use `getTemplate` to look
 * up a template and `interpolate` to fill in the placeholders.
 */

/** @type {Map<string, { templateKey: string, text: string }>} */
const TEMPLATES = new Map([
  [
    'FOLLOW_UP:NO_RESPONSE',
    {
      templateKey: 'followup_no_response',
      text: 'Hola {{fullName}}, queríamos retomar la conversación y saber si podemos apoyarle en algo. ¿Tiene unos minutos para conversar? Puede agendar aquí: {{calendlyUrl}}',
    },
  ],
  [
    'FOLLOW_UP:CALL_LATER',
    {
      templateKey: 'followup_call_later',
      text: 'Hola {{fullName}}, en su momento nos pidió contactarlo más adelante. Queríamos retomar la conversación y ver cómo podemos ayudarle. ¿Le parece bien si hablamos? Puede agendar aquí: {{calendlyUrl}}',
    },
  ],
  [
    'FOLLOW_UP:THINKING',
    {
      templateKey: 'followup_generic',
      text: 'Hola {{fullName}}, ¿cómo ha estado? Queríamos saber si le podemos ayudar con algo.',
    },
  ],
  [
    'FOLLOW_UP:NO_MONEY',
    {
      templateKey: 'followup_generic',
      text: 'Hola {{fullName}}, ¿cómo ha estado? Queríamos saber si le podemos ayudar con algo.',
    },
  ],
  [
    'FOLLOW_UP:BUSY',
    {
      templateKey: 'followup_generic',
      text: 'Hola {{fullName}}, ¿cómo ha estado? Queríamos saber si le podemos ayudar con algo.',
    },
  ],
  [
    'FOLLOW_UP:OTHER',
    {
      templateKey: 'followup_generic',
      text: 'Hola {{fullName}}, ¿cómo ha estado? Queríamos saber si le podemos ayudar con algo.',
    },
  ],
  [
    'manual_intro',
    {
      templateKey: 'manual_intro',
      text: 'Hola {{fullName}}, le escribe {{ownerName}} de VR Consultorías. ¿Tiene un momento para conversar?',
    },
  ],
]);

/**
 * Look up a template by lead status and follow-up reason.
 *
 * For manual sends (no status/reason), pass `'manual_intro'` as the status
 * and omit followUpReason.
 *
 * @param {string} status          - Lead status (e.g. 'FOLLOW_UP') or 'manual_intro'
 * @param {string} [followUpReason] - Follow-up reason (e.g. 'NO_RESPONSE'), optional
 * @returns {{ templateKey: string, text: string }|null}
 */
export function getTemplate(status, followUpReason) {
  if (status === 'manual_intro') {
    return TEMPLATES.get('manual_intro') ?? null;
  }
  const key = followUpReason ? `${status}:${followUpReason}` : status;
  return TEMPLATES.get(key) ?? null;
}

/**
 * Replace `{{fullName}}`, `{{ownerName}}`, and `{{calendlyUrl}}` placeholders
 * in a template text string with values from the variables object.
 * Missing variables are replaced with an empty string.
 *
 * @param {string} text
 * @param {{ fullName?: string, ownerName?: string, calendlyUrl?: string }} variables
 * @returns {string}
 */
export function interpolate(text, variables) {
  const { fullName = '', ownerName = '', calendlyUrl = '' } = variables ?? {};
  return text
    .replace(/\{\{fullName\}\}/g, fullName)
    .replace(/\{\{ownerName\}\}/g, ownerName)
    .replace(/\{\{calendlyUrl\}\}/g, calendlyUrl);
}

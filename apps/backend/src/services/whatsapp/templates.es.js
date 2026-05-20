/**
 * templates.es.js — Spanish WhatsApp message template catalog.
 *
 * Each template declares:
 *   - templateKey: the EXACT name as registered in Meta (lowercase, underscores)
 *   - text:        body text with named placeholders (used for dry-run preview)
 *   - variables:   ordered list of variable names that map to Meta's positional
 *                  {{1}}, {{2}}, … placeholders at send time. The provider uses
 *                  this list to build the parameters array sent to the API, so
 *                  the order MUST match the {{N}} sequence used when the
 *                  template was registered in WhatsApp Manager.
 *
 * Lookup helpers:
 *   - getTemplate(status, reason)   → by (LeadStatus, FollowUpReason)
 *   - getTemplateByKey(templateKey) → by Meta template name (used by provider)
 */

/**
 * @typedef {Object} TemplateDef
 * @property {string}   templateKey  Exact name in Meta.
 * @property {string}   text         Body text with `{{varName}}` placeholders.
 * @property {string[]} variables    Variable names in the order they appear as {{1}}, {{2}}, …
 */

/** @type {Map<string, TemplateDef>} */
const TEMPLATES = new Map([
  [
    'FOLLOW_UP:NO_RESPONSE',
    {
      templateKey: 'followup_no_response',
      text: 'Hola {{fullName}}, queríamos retomar la conversación y saber si podemos apoyarle en algo. ¿Tiene unos minutos para conversar? Puede agendar aquí: {{calendlyUrl}}',
      variables: ['fullName', 'calendlyUrl'],
    },
  ],
  [
    'FOLLOW_UP:CALL_LATER',
    {
      templateKey: 'followup_call_later',
      text: 'Hola {{fullName}}, en su momento nos pidió contactarlo más adelante. Queríamos retomar la conversación y ver cómo podemos ayudarle. ¿Le parece bien si hablamos? Puede agendar aquí: {{calendlyUrl}}',
      variables: ['fullName', 'calendlyUrl'],
    },
  ],
  [
    'FOLLOW_UP:THINKING',
    {
      templateKey: 'followup_generic',
      text: 'Hola {{fullName}}, ¿cómo ha estado? Queríamos saber si le podemos ayudar con algo.',
      variables: ['fullName'],
    },
  ],
  [
    'FOLLOW_UP:NO_MONEY',
    {
      templateKey: 'followup_generic',
      text: 'Hola {{fullName}}, ¿cómo ha estado? Queríamos saber si le podemos ayudar con algo.',
      variables: ['fullName'],
    },
  ],
  [
    'FOLLOW_UP:BUSY',
    {
      templateKey: 'followup_generic',
      text: 'Hola {{fullName}}, ¿cómo ha estado? Queríamos saber si le podemos ayudar con algo.',
      variables: ['fullName'],
    },
  ],
  [
    'FOLLOW_UP:OTHER',
    {
      templateKey: 'followup_generic',
      text: 'Hola {{fullName}}, ¿cómo ha estado? Queríamos saber si le podemos ayudar con algo.',
      variables: ['fullName'],
    },
  ],
  [
    'manual_intro',
    {
      templateKey: 'manual_intro',
      text: 'Hola {{fullName}}, le escribe {{ownerName}} de VR Consultorías. ¿Tiene un momento para conversar?',
      variables: ['fullName', 'ownerName'],
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
 * @returns {TemplateDef|null}
 */
export function getTemplate(status, followUpReason) {
  if (status === 'manual_intro') {
    return TEMPLATES.get('manual_intro') ?? null;
  }
  const key = followUpReason ? `${status}:${followUpReason}` : status;
  return TEMPLATES.get(key) ?? null;
}

/**
 * Look up a template by lead status and follow-up reason, throwing if not found.
 *
 * @param {string} status
 * @param {string} [followUpReason]
 * @returns {TemplateDef}
 * @throws {Error} if no template matches
 */
export function getTemplateOrThrow(status, followUpReason) {
  const tpl = getTemplate(status, followUpReason);
  if (!tpl) throw new Error(`No WhatsApp template found for status=${status} reason=${followUpReason}`);
  return tpl;
}

/**
 * Look up a template by its Meta template key (the `templateKey` field).
 * Used by the WhatsApp provider to derive the parameter order at send time.
 *
 * Several (status, reason) pairs can map to the same templateKey
 * (e.g. THINKING/NO_MONEY/BUSY/OTHER all → followup_generic). Since all
 * pairs that share a templateKey share the same text and variables, returning
 * the first match is unambiguous.
 *
 * @param {string} templateKey
 * @returns {TemplateDef|null}
 */
export function getTemplateByKey(templateKey) {
  for (const tpl of TEMPLATES.values()) {
    if (tpl.templateKey === templateKey) return tpl;
  }
  return null;
}

/**
 * Replace `{{name}}` placeholders in a template text with values from the
 * variables object. Any placeholder whose name is not in `variables` is
 * replaced with the empty string. Useful for dry-run preview in the noop
 * provider; the meta provider builds positional parameters from the
 * template definition instead.
 *
 * @param {string} text
 * @param {Record<string, string>} [variables]
 * @returns {string}
 */
export function interpolate(text, variables) {
  const vars = variables ?? {};
  return text.replace(/\{\{([a-zA-Z][a-zA-Z0-9_]*)\}\}/g, (_, name) =>
    String(vars[name] ?? '')
  );
}

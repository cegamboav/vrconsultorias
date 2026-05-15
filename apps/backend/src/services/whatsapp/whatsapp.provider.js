/**
 * WhatsAppProvider — base interface for all WhatsApp provider implementations.
 *
 * Subclasses must override `sendTemplate`.
 */
export class WhatsAppProvider {
  /**
   * Send a WhatsApp template message.
   *
   * @param {object} params
   * @param {string} params.to            - Destination phone number in E.164 format (e.g. "+50688887777")
   * @param {string} params.templateKey   - Template identifier key (see templates.es.js)
   * @param {object} params.variables     - Interpolation variables: { fullName, ownerName, calendlyUrl }
   * @param {string|number} params.leadId - Lead ID for tracing/logging
   * @returns {Promise<{ providerMessageId: string|null, status: string, raw: object|null }>}
   */
  async sendTemplate({ to, templateKey, variables, leadId }) {
    throw new Error(
      `WhatsAppProvider.sendTemplate() not implemented — subclass must override it. Called with leadId=${leadId}, template=${templateKey}, to=${to}`
    );
  }
}

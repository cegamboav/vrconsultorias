import { WhatsAppProvider } from './whatsapp.provider.js';

/**
 * NoopWhatsAppProvider — dry-run provider used in development and when no
 * real WhatsApp credentials are configured. Logs the intended call and returns
 * a DRY_RUN result without making any network request.
 */
export class NoopWhatsAppProvider extends WhatsAppProvider {
  async sendTemplate({ to, templateKey, variables, leadId }) {
    console.log(
      `[WhatsApp:NOOP] leadId=${leadId} to=${to} template=${templateKey} variables=${JSON.stringify(variables)}`
    );
    return {
      providerMessageId: null,
      status: 'DRY_RUN',
      raw: null,
    };
  }
}

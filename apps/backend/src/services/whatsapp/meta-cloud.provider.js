import { WhatsAppProvider } from './whatsapp.provider.js';
import { AppError } from '../../utils/app-error.js';
import { env } from '../../config/env.js';

/**
 * MetaCloudWhatsAppProvider — sends template messages via the Meta Cloud API
 * (graph.facebook.com).
 *
 * API call shape (for reference when token arrives):
 *
 *   POST https://graph.facebook.com/{apiVersion}/{phoneNumberId}/messages
 *   Authorization: Bearer {token}
 *   Content-Type: application/json
 *   Body: {
 *     messaging_product: "whatsapp",
 *     to: "{to}",               // E.164 without the leading "+"
 *     type: "template",
 *     template: {
 *       name: "{templateKey}",
 *       language: { code: "es" },
 *       components: [
 *         {
 *           type: "body",
 *           parameters: [
 *             { type: "text", text: "{fullName}" },
 *             { type: "text", text: "{ownerName}" },
 *             { type: "text", text: "{calendlyUrl}" }
 *           ]
 *         }
 *       ]
 *     }
 *   }
 *
 * Response shape:
 *   {
 *     messaging_product: "whatsapp",
 *     contacts: [{ input: "...", wa_id: "..." }],
 *     messages: [{ id: "wamid.xxx..." }]
 *   }
 */
export class MetaCloudWhatsAppProvider extends WhatsAppProvider {
  constructor() {
    super();
    if (!env.whatsapp.token || !env.whatsapp.phoneNumberId) {
      throw new AppError(
        'MetaCloudWhatsAppProvider requires WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID env vars',
        500
      );
    }
    this.token = env.whatsapp.token;
    this.phoneNumberId = env.whatsapp.phoneNumberId;
    this.apiVersion = env.whatsapp.apiVersion;
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;
  }

  async sendTemplate({ to, templateKey, variables, leadId }) {
    const { fullName = '', ownerName = '', calendlyUrl = '' } = variables ?? {};

    // TODO: uncomment when real credentials arrive and remove the stub below.
    // const response = await fetch(this.baseUrl, {
    //   method: 'POST',
    //   headers: {
    //     Authorization: `Bearer ${this.token}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({
    //     messaging_product: 'whatsapp',
    //     to: to.replace(/^\+/, ''),
    //     type: 'template',
    //     template: {
    //       name: templateKey,
    //       language: { code: 'es' },
    //       components: [
    //         {
    //           type: 'body',
    //           parameters: [
    //             { type: 'text', text: fullName },
    //             { type: 'text', text: ownerName },
    //             { type: 'text', text: calendlyUrl },
    //           ],
    //         },
    //       ],
    //     },
    //   }),
    // });
    // if (!response.ok) {
    //   const err = await response.json().catch(() => ({}));
    //   throw new AppError(`Meta Cloud API error: ${JSON.stringify(err)}`, 502);
    // }
    // const data = await response.json();
    // return {
    //   providerMessageId: data.messages?.[0]?.id ?? null,
    //   status: 'SENT',
    //   raw: data,
    // };

    // STUB — real HTTP call is documented above, awaiting client credentials.
    console.log(
      `[WhatsApp:META] leadId=${leadId} to=${to} template=${templateKey} variables=${JSON.stringify({ fullName, ownerName, calendlyUrl })}`
    );
    return {
      providerMessageId: null,
      status: 'STUB', // Will become 'SENT' when the real fetch call is enabled
      raw: null,
    };
  }
}

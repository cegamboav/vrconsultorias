import { env } from '../../config/env.js';
import { NoopWhatsAppProvider } from './noop.provider.js';
import { MetaCloudWhatsAppProvider } from './meta-cloud.provider.js';

/**
 * Factory: returns the WhatsApp provider configured via WHATSAPP_PROVIDER env var.
 *
 * Supported values:
 *   'noop'  — NoopWhatsAppProvider (default, dry-run, no network calls)
 *   'meta'  — MetaCloudWhatsAppProvider (requires WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID)
 *
 * @returns {import('./whatsapp.provider.js').WhatsAppProvider}
 */
function createWhatsAppProvider() {
  const providerName = env.whatsapp.provider;

  switch (providerName) {
    case 'meta':
      return new MetaCloudWhatsAppProvider();
    case 'noop':
    default:
      if (providerName !== 'noop') {
        console.warn(
          `[WhatsApp] Unknown provider "${providerName}", falling back to noop.`
        );
      }
      return new NoopWhatsAppProvider();
  }
}

/** Singleton WhatsApp provider instance */
export const whatsappProvider = createWhatsAppProvider();

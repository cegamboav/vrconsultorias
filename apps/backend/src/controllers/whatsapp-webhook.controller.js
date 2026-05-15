import { asyncHandler } from '../utils/async-handler.js';
import { env } from '../config/env.js';
import { handleInboundMessage } from '../services/inbound-whatsapp.service.js';

export const verifyWebhook = asyncHandler(async (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === env.whatsapp.webhookVerifyToken) {
    return res.status(200).send(challenge);
  }
  return res.status(403).json({ message: 'Verification failed.' });
});

export const receiveMessage = asyncHandler(async (req, res) => {
  // Respond 200 immediately — Meta requires acknowledgment within 20s
  res.status(200).json({ status: 'ok' });

  // Process asynchronously (fire-and-forget)
  try {
    const entries = req.body?.entry ?? [];
    for (const entry of entries) {
      for (const change of entry.changes ?? []) {
        const messages = change.value?.messages ?? [];
        for (const message of messages) {
          if (message.type !== 'text') continue;
          await handleInboundMessage({
            from: message.from,
            text: message.text?.body ?? '',
            providerMessageId: message.id,
            receivedAt: message.timestamp,
          });
        }
      }
    }
  } catch (err) {
    console.error('[whatsapp-webhook] processing error:', err);
  }
});

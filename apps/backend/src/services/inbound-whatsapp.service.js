import { prisma, ActivityType } from '@crm/database';
import { toE164 } from '../utils/phone.js';
import { classifyAndSuggest } from './inbound-classifier.service.js';

export async function handleInboundMessage({ from, text, providerMessageId, receivedAt }) {
  const normalizedPhone = toE164(from);

  const lead = await prisma.lead.findUnique({
    where: { phone: normalizedPhone },
    include: {
      activities: {
        orderBy: { createdAt: 'desc' },
        take: 3,
      },
    },
  });

  if (!lead) {
    console.warn(`[inbound-whatsapp] no lead found for phone ${normalizedPhone.slice(0, 6)}***`);
    return null;
  }

  // Run classifier (non-blocking failure — if it fails, we still save the activity)
  const classification = await classifyAndSuggest({ lead, text }).catch(() => null);

  const ts = Number(receivedAt);
  const receivedDate = receivedAt && !isNaN(ts) ? new Date(ts * 1000) : new Date();

  await prisma.$transaction(async (tx) => {
    await tx.lead.update({
      where: { id: lead.id },
      data: { lastActivityAt: receivedDate },
    });

    await tx.activity.create({
      data: {
        leadId: lead.id,
        userId: null,
        type: ActivityType.WHATSAPP_RECEIVED,
        description: `WhatsApp recibido: "${text.slice(0, 80)}${text.length > 80 ? '...' : ''}"`,
        metadata: {
          providerMessageId,
          from: normalizedPhone,
          text,
          receivedAt: receivedDate.toISOString(),
          ...(classification
            ? {
                classification: classification.classification,
                intent: classification.intent,
                suggestedReply: classification.suggestedReply,
                confidence: classification.confidence,
                model: classification.model,
                suggestionStatus: 'pending',
              }
            : {}),
        },
      },
    });
  });

  return { leadId: lead.id, classification: classification?.classification ?? null };
}

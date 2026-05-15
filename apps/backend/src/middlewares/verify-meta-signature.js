import crypto from 'node:crypto';
import { env } from '../config/env.js';

export function verifyMetaSignature(req, res, next) {
  const signature = req.headers['x-hub-signature-256'];
  const appSecret = env.whatsapp.appSecret;

  // If no app secret configured, skip verification in dev
  if (!appSecret) {
    if (env.nodeEnv === 'production') {
      return res.status(401).json({ message: 'Webhook signature verification not configured.' });
    }
    return next();
  }

  if (!signature) {
    return res.status(401).json({ message: 'Missing X-Hub-Signature-256 header.' });
  }

  const [algo, hash] = signature.split('=');
  if (algo !== 'sha256' || !hash) {
    return res.status(401).json({ message: 'Invalid signature format.' });
  }

  const expected = crypto
    .createHmac('sha256', appSecret)
    .update(req.rawBody ?? '')
    .digest('hex');

  let isValid = false;
  try {
    isValid = crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    // Buffer lengths differ — invalid signature
    isValid = false;
  }

  if (!isValid) {
    return res.status(401).json({ message: 'Invalid webhook signature.' });
  }

  return next();
}

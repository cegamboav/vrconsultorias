import { Router } from 'express';
import { verifyMetaSignature } from '../../middlewares/verify-meta-signature.js';
import { verifyWebhook, receiveMessage } from '../../controllers/whatsapp-webhook.controller.js';

const webhookRouter = Router();

webhookRouter.get('/inbound', verifyWebhook);
webhookRouter.post('/inbound', verifyMetaSignature, receiveMessage);

export default webhookRouter;

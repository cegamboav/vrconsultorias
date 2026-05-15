-- Add WHATSAPP_RECEIVED to ActivityType enum (Phase 3: inbound webhook)
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'WHATSAPP_RECEIVED';

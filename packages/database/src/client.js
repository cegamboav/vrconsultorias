import {
  PrismaClient,
  ActivityType,
  FollowUpReason,
  LeadSource,
  LeadStatus,
  Role
} from "@prisma/client";

export const prisma = new PrismaClient();

export {
  ActivityType,
  FollowUpReason,
  LeadSource,
  LeadStatus,
  Role
};

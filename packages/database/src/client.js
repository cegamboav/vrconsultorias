import {
  PrismaClient,
  ActivityType,
  LeadSource,
  LeadStatus,
  CloseSubstatus,
  Role
} from "@prisma/client";

export const prisma = new PrismaClient();

export {
  ActivityType,
  LeadSource,
  LeadStatus,
  CloseSubstatus,
  Role
};
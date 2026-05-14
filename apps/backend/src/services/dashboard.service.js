import { prisma, LeadStatus } from "@crm/database";
import { addDaysLocal, startOfLocalDay } from "../utils/follow-up-date.js";

const leadMiniSelect = {
  id: true,
  leadNumber: true,
  fullName: true,
  phone: true,
  status: true,
  followUpReason: true,
  followUpCount: true,
  nextActionDate: true,
  updatedAt: true,
  closedAt: true,
  createdAt: true
};

export async function getDashboardSnapshot() {
  const todayStart = startOfLocalDay(new Date());
  const tomorrowStart = addDaysLocal(todayStart, 1);

  const [
    followUpUrgent,
    recentClosedLeads,
    recentActivities,
    colNuevo,
    colContactado,
    colAgendado,
    colSeguimiento
  ] = await Promise.all([
    prisma.lead.findMany({
      where: {
        status: LeadStatus.FOLLOW_UP,
        nextActionDate: { not: null, lt: tomorrowStart }
      },
      orderBy: { nextActionDate: "asc" },
      take: 20,
      select: leadMiniSelect
    }),
    prisma.lead.findMany({
      where: {
        status: { in: [LeadStatus.CLOSED_INVESTED, LeadStatus.CLOSED_NOT_INVESTED] }
      },
      orderBy: { closedAt: "desc" },
      take: 25,
      select: leadMiniSelect
    }),
    prisma.activity.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        type: true,
        description: true,
        createdAt: true,
        lead: {
          select: { id: true, leadNumber: true, fullName: true }
        },
        user: { select: { name: true } }
      }
    }),
    prisma.lead.findMany({
      where: { status: LeadStatus.NEW },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: leadMiniSelect
    }),
    prisma.lead.findMany({
      where: { status: LeadStatus.CONTACTED },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: leadMiniSelect
    }),
    prisma.lead.findMany({
      where: { status: LeadStatus.SCHEDULED },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: leadMiniSelect
    }),
    prisma.lead.findMany({
      where: { status: LeadStatus.FOLLOW_UP },
      orderBy: { nextActionDate: "asc" },
      take: 8,
      select: leadMiniSelect
    })
  ]);

  return {
    followUpUrgent,
    recentClosedLeads,
    recentActivities,
    pipeline: {
      nuevo: colNuevo,
      contactado: colContactado,
      agendado: colAgendado,
      seguimiento: colSeguimiento
    }
  };
}

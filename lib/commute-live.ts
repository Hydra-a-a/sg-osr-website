import 'server-only';

import { Prisma } from '@prisma/client';
import { ApiError } from '@/lib/api-errors';
import { prisma } from '@/lib/prisma';
import { sanitizeText } from '@/lib/security';
import {
  COMMUTE_ALERT_EXPIRY_MINUTES,
  COMMUTE_LIVE_CORRIDORS,
  type ModerateCommuteAlertInput,
  type OfficialCommuteAlertInput,
  type PublicCommuteAlert,
  type StudentCommuteAlertInput,
} from '@/schemas/commute-live';

function corridorLabel(corridorId: string) {
  const corridor = COMMUTE_LIVE_CORRIDORS.find((item) => item.id === corridorId);
  if (!corridor) throw new ApiError(400, 'INVALID_CORRIDOR', 'Choose a supported commute corridor.');
  return corridor.label;
}

async function getPublicAlert(alertId: string): Promise<PublicCommuteAlert> {
  const alert = await prisma.commuteAlert.findUnique({
    where: { alertId },
    select: {
      alertId: true,
      corridorId: true,
      corridorLabel: true,
      kind: true,
      severity: true,
      officialTitle: true,
      officialSummary: true,
      sourceUrl: true,
      createdAt: true,
      expiresAt: true,
      _count: { select: { confirmations: true } },
    },
  });
  if (!alert) throw new ApiError(404, 'ALERT_NOT_FOUND', 'That commute update is no longer available.');
  const { _count, createdAt, expiresAt, ...publicAlert } = alert;
  return {
    ...publicAlert,
    confirmationCount: _count.confirmations,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

export async function listPublicCommuteAlerts(): Promise<PublicCommuteAlert[]> {
  const alerts = await prisma.commuteAlert.findMany({
    where: { status: 'ACTIVE', expiresAt: { gt: new Date() } },
    orderBy: [{ kind: 'desc' }, { createdAt: 'desc' }],
    take: 50,
    select: {
      alertId: true,
      corridorId: true,
      corridorLabel: true,
      kind: true,
      severity: true,
      officialTitle: true,
      officialSummary: true,
      sourceUrl: true,
      createdAt: true,
      expiresAt: true,
      _count: { select: { confirmations: true } },
    },
  });

  return alerts.map(({ _count, createdAt, expiresAt, ...alert }) => ({
    ...alert,
    confirmationCount: _count.confirmations,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  }));
}

export async function createStudentCommuteAlert(
  input: StudentCommuteAlertInput,
  reporterEmail: string,
) {
  const now = new Date();
  const duplicate = await prisma.commuteAlert.findFirst({
    where: {
      reporterEmail,
      corridorId: input.corridorId,
      kind: input.kind,
      status: 'ACTIVE',
      expiresAt: { gt: now },
      createdAt: { gt: new Date(now.getTime() - 15 * 60_000) },
    },
    select: { alertId: true },
  });
  if (duplicate) {
    throw new ApiError(409, 'DUPLICATE_ALERT', 'You already posted this update recently.');
  }

  const created = await prisma.commuteAlert.create({
    data: {
      corridorId: input.corridorId,
      corridorLabel: corridorLabel(input.corridorId),
      kind: input.kind,
      severity: input.severity,
      reporterEmail,
      privateNote: sanitizeText(input.privateNote),
      expiresAt: new Date(now.getTime() + COMMUTE_ALERT_EXPIRY_MINUTES[input.kind] * 60_000),
    },
    select: { alertId: true },
  });
  return getPublicAlert(created.alertId);
}

export async function confirmCommuteAlert(alertId: string, confirmerEmail: string) {
  try {
    await prisma.$transaction(async (tx) => {
      const alert = await tx.commuteAlert.findUnique({
        where: { alertId },
        select: { reporterEmail: true, kind: true, status: true, expiresAt: true },
      });
      if (!alert || alert.status !== 'ACTIVE' || alert.expiresAt <= new Date()) {
        throw new ApiError(404, 'ALERT_NOT_FOUND', 'That commute update is no longer active.');
      }
      if (alert.reporterEmail === confirmerEmail) {
        throw new ApiError(409, 'SELF_CONFIRMATION', 'Another commuter must confirm this update.');
      }
      if (alert.kind === 'OFFICIAL') {
        throw new ApiError(409, 'OFFICIAL_ALERT', 'Official updates do not need student confirmation.');
      }
      await tx.commuteAlertConfirmation.create({ data: { alertId, confirmerEmail } });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ApiError(409, 'ALREADY_CONFIRMED', 'You already confirmed this update.');
    }
    throw error;
  }
  return getPublicAlert(alertId);
}

export async function createOfficialCommuteAlert(
  input: OfficialCommuteAlertInput,
  officerEmail: string,
) {
  const created = await prisma.commuteAlert.create({
    data: {
      corridorId: input.corridorId,
      corridorLabel: corridorLabel(input.corridorId),
      kind: 'OFFICIAL',
      severity: 'INFO',
      reporterEmail: officerEmail,
      officialTitle: sanitizeText(input.title),
      officialSummary: sanitizeText(input.summary),
      sourceUrl: input.sourceUrl,
      expiresAt: new Date(Date.now() + input.durationMinutes * 60_000),
    },
    select: { alertId: true },
  });
  return getPublicAlert(created.alertId);
}

export async function moderateCommuteAlert(
  input: ModerateCommuteAlertInput,
  officerEmail: string,
) {
  const existing = await prisma.commuteAlert.findUnique({
    where: { alertId: input.alertId },
    select: { alertId: true },
  });
  if (!existing) throw new ApiError(404, 'ALERT_NOT_FOUND', 'Commute update not found.');

  await prisma.commuteAlert.update({
    where: { alertId: input.alertId },
    data: {
      status: input.action === 'RESOLVE' ? 'RESOLVED' : 'HIDDEN',
      resolvedAt: input.action === 'RESOLVE' ? new Date() : null,
      moderatedAt: new Date(),
      moderatedBy: officerEmail,
    },
  });
}

export async function getCommuteLiveAdminSnapshot() {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60_000);
  const [alerts, confirmations] = await Promise.all([
    prisma.commuteAlert.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: {
        alertId: true,
        corridorId: true,
        corridorLabel: true,
        kind: true,
        severity: true,
        status: true,
        reporterEmail: true,
        privateNote: true,
        officialTitle: true,
        officialSummary: true,
        sourceUrl: true,
        expiresAt: true,
        createdAt: true,
        _count: { select: { confirmations: true } },
      },
    }),
    prisma.commuteAlertConfirmation.findMany({
      where: { createdAt: { gte: since } },
      select: { confirmerEmail: true, createdAt: true },
    }),
  ]);

  const windows = [7, 30, 90].map((days) => {
    const cutoff = Date.now() - days * 24 * 60 * 60_000;
    const windowAlerts = alerts.filter((alert) => alert.createdAt.getTime() >= cutoff);
    const windowConfirmations = confirmations.filter((item) => item.createdAt.getTime() >= cutoff);
    const students = new Set([
      ...windowAlerts.filter((alert) => alert.kind !== 'OFFICIAL').map((alert) => alert.reporterEmail),
      ...windowConfirmations.map((item) => item.confirmerEmail),
    ]);
    return {
      days,
      studentReports: windowAlerts.filter((alert) => alert.kind !== 'OFFICIAL').length,
      confirmations: windowConfirmations.length,
      officialUpdates: windowAlerts.filter((alert) => alert.kind === 'OFFICIAL').length,
      activeStudents: students.size,
      corridors: new Set(windowAlerts.map((alert) => alert.corridorId)).size,
    };
  });

  return {
    windows,
    alerts: alerts
      .filter((alert) => alert.status === 'ACTIVE' && alert.expiresAt > new Date())
      .map(({ _count, createdAt, expiresAt, ...alert }) => ({
        ...alert,
        confirmationCount: _count.confirmations,
        createdAt: createdAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
      })),
  };
}

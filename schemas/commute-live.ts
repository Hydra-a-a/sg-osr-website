import { z } from 'zod';

export const COMMUTE_LIVE_CORRIDORS = [
  { id: 'rtu-boni', label: 'RTU Boni corridor' },
  { id: 'rtu-pasig', label: 'RTU Pasig corridor' },
  { id: 'boni-pasig', label: 'Boni–Pasig campus connection' },
] as const;

export const STUDENT_COMMUTE_ALERT_KINDS = [
  'DELAY',
  'CROWDING',
  'FLOODING',
  'CLOSURE',
  'RECOVERY',
] as const;

export const COMMUTE_ALERT_EXPIRY_MINUTES: Record<
  (typeof STUDENT_COMMUTE_ALERT_KINDS)[number],
  number
> = {
  DELAY: 90,
  CROWDING: 60,
  FLOODING: 180,
  CLOSURE: 240,
  RECOVERY: 60,
};

const corridorIds = COMMUTE_LIVE_CORRIDORS.map((corridor) => corridor.id) as [
  string,
  ...string[],
];

export const studentCommuteAlertSchema = z.object({
  corridorId: z.enum(corridorIds),
  kind: z.enum(STUDENT_COMMUTE_ALERT_KINDS),
  severity: z.enum(['INFO', 'MODERATE', 'SEVERE']),
  privateNote: z.string().trim().max(300).optional().default(''),
});

export const commuteAlertConfirmationSchema = z.object({
  alertId: z.string().trim().min(8).max(80),
});

const OFFICIAL_SOURCE_HOSTS = [
  'dotrmrt3.gov.ph',
  'lrta.gov.ph',
  'lrmc.ph',
  'mmda.gov.ph',
] as const;

function isOfficialSource(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      OFFICIAL_SOURCE_HOSTS.some(
        (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
      )
    );
  } catch {
    return false;
  }
}

export const officialCommuteAlertSchema = z.object({
  corridorId: z.enum(corridorIds),
  title: z.string().trim().min(3).max(100),
  summary: z.string().trim().min(3).max(240),
  sourceUrl: z
    .string()
    .trim()
    .url()
    .refine(isOfficialSource, 'Use an approved official transport source.'),
  durationMinutes: z.coerce.number().int().min(15).max(1440).default(180),
});

export const moderateCommuteAlertSchema = z.object({
  alertId: z.string().trim().min(8).max(80),
  action: z.enum(['RESOLVE', 'HIDE']),
});

export type StudentCommuteAlertInput = z.infer<typeof studentCommuteAlertSchema>;
export type OfficialCommuteAlertInput = z.infer<typeof officialCommuteAlertSchema>;
export type ModerateCommuteAlertInput = z.infer<typeof moderateCommuteAlertSchema>;

export type PublicCommuteAlert = {
  alertId: string;
  corridorId: string;
  corridorLabel: string;
  kind: (typeof STUDENT_COMMUTE_ALERT_KINDS)[number] | 'OFFICIAL';
  severity: 'INFO' | 'MODERATE' | 'SEVERE';
  officialTitle: string;
  officialSummary: string;
  sourceUrl: string;
  confirmationCount: number;
  createdAt: string;
  expiresAt: string;
};

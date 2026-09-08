import { z } from 'zod';

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Enter a valid calendar date.');
export const periodSchema = z.object({
  title: z.string().trim().min(3).max(200),
  academicYearStart: z.number().int().min(2000).max(2100),
  periodKind: z.enum(['ANNUAL', 'SEMESTER', 'QUARTER', 'MONTH']),
  periodNumber: z.number().int().nullable().optional(),
  periodStart: dateSchema,
  periodEnd: dateSchema,
}).superRefine((value, ctx) => {
  const maximum = { ANNUAL: 0, SEMESTER: 2, QUARTER: 4, MONTH: 12 }[value.periodKind];
  if (maximum === 0 ? value.periodNumber != null : value.periodNumber == null || value.periodNumber < 1 || value.periodNumber > maximum) {
    ctx.addIssue({ code: 'custom', path: ['periodNumber'], message: 'Choose the applicable reporting period.' });
  }
  if (value.periodEnd < value.periodStart || value.periodStart < `${value.academicYearStart}-01-01` || value.periodEnd > `${value.academicYearStart + 1}-12-31`) {
    ctx.addIssue({ code: 'custom', path: ['periodEnd'], message: 'Dates must be ordered and within the academic year’s two calendar years.' });
  }
});
export const amountSchema = z.string().regex(/^(0|[1-9]\d{0,11})(\.\d{1,2})?$/, 'Use a nonnegative peso amount with at most two decimal places.');
export function cents(value: string): bigint {
  const [whole, fraction = ''] = amountSchema.parse(value).split('.');
  return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, '0'));
}
function decimal(value: bigint): string {
  const sign = value < BigInt(0) ? '-' : '';
  const absolute = value < BigInt(0) ? -value : value;
  return `${sign}${absolute / BigInt(100)}.${String(absolute % BigInt(100)).padStart(2, '0')}`;
}
export function budgetTotals(lines: { allocated: string; spent: string }[]) {
  const allocated = lines.reduce((sum, line) => sum + cents(line.allocated), BigInt(0));
  const spent = lines.reduce((sum, line) => sum + cents(line.spent), BigInt(0));
  return { allocated: decimal(allocated), spent: decimal(spent), balance: decimal(allocated - spent), utilization: allocated === BigInt(0) ? null : decimal((spent * BigInt(10000) + allocated / BigInt(2)) / allocated) };
}
export const budgetLineSchema = z.object({
  projectTitle: z.string().trim().min(1).max(200),
  projectCode: z.string().trim().max(50).default(''),
  category: z.string().trim().min(1).max(100),
  publicNote: z.string().trim().max(2000).default(''),
  allocated: amountSchema,
  spent: amountSchema,
}).refine(line => {
  const allocated = amountSchema.safeParse(line.allocated);
  const spent = amountSchema.safeParse(line.spent);
  return !allocated.success || !spent.success || cents(spent.data) <= cents(allocated.data) || line.publicNote.length >= 10;
}, { path: ['publicNote'], message: 'Explain spending above allocation in the public note (at least 10 characters).' });
export const reportMetadataSchema = periodSchema.safeExtend({
  asOfDate: dateSchema,
  notes: z.string().trim().max(10000).default(''),
  correctionReason: z.string().trim().max(2000).default(''),
});
const versionFields = { id: z.string().min(1).max(100), version: z.number().int().positive() };
export const reportActionSchema = z.discriminatedUnion('action', [
  z.object({ ...versionFields, action: z.literal('save'), metadata: reportMetadataSchema, lines: z.array(budgetLineSchema).max(300) }),
  z.object({ ...versionFields, action: z.literal('ready') }),
  z.object({ ...versionFields, action: z.literal('publish'), approvedForPublicRelease: z.literal(true) }),
  z.object({ ...versionFields, action: z.literal('changes'), reason: z.string().trim().min(5).max(2000) }),
  z.object({ ...versionFields, action: z.literal('withdraw'), reason: z.string().trim().min(5).max(2000) }),
]);
export const feedbackSchema = z.object({ reportId: z.string().min(1).max(100), projectId: z.string().min(1).max(100).nullable().optional(), category: z.enum(['QUESTION', 'CORRECTION', 'MISSING_INFORMATION', 'OTHER']), message: z.string().trim().min(10).max(4000) });
export const feedbackUpdateSchema = z.object({ id: z.string().min(1).max(100), status: z.enum(['OPEN', 'IN_REVIEW', 'RESOLVED']), response: z.string().trim().max(4000) });
export type PublicTransparencyReport = {
  id: string; slug: string; title: string; organizationName: string; academicYearStart: number;
  periodKind: string; periodNumber: number | null; periodStart: string; periodEnd: string; asOfDate: string;
  publishedAt: string | null; status: 'PUBLISHED' | 'SUPERSEDED' | 'WITHDRAWN'; notes: string | null;
  correctionReason: string | null; withdrawalReason: string | null; withdrawnAt: string | null;
  predecessor: { slug: string; title: string } | null;
  successor: { slug: string; title: string; publishedAt: string | null; correctionReason: string | null } | null;
  pdf: { fileId: string; fileName: string } | null;
  lines: { id: string; projectTitle: string; projectCode: string; category: string; publicNote: string; allocated: string; spent: string; balance: string; utilization: string | null }[];
  totals: ReturnType<typeof budgetTotals>;
};

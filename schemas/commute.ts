import { z } from 'zod';

export const CommuteRequestSchema = z.object({
    origin: z.string().min(2, "Origin must be at least 2 characters").max(200, "Origin must be at most 200 characters"),
    destination: z.string().min(2, "Destination must be at least 2 characters").max(200, "Destination must be at most 200 characters"),
    preference: z.enum(['fastest', 'cheapest', 'fewest_transfers']).optional().default('fastest'),
});

export type CommuteRequest = z.infer<typeof CommuteRequestSchema>;

export const CommuteStepSchema = z.object({
    type: z.enum(['WALK', 'JEEP', 'BUS', 'MRT', 'LRT', 'TRICYCLE', 'UV']),
    instruction: z.string(),
    durationMins: z.number().optional(),
    colorCode: z.string().optional(),
    fare: z.string().optional(),
});

export type CommuteStep = z.infer<typeof CommuteStepSchema>;

export const CommuteSummarySchema = z.object({
    totalDurationMins: z.number().optional(),
    totalDistanceKm: z.number().optional(),
    fareEstimateRange: z.string().optional(),
});

export type CommuteSummary = z.infer<typeof CommuteSummarySchema>;

export const CommuteNoticeSchema = z.object({
    type: z.enum(['warning', 'info']),
    message: z.string(),
});

export type CommuteNotice = z.infer<typeof CommuteNoticeSchema>;

export const CommuteResponseSchema = z.object({
    status: z.enum(['success', 'fallback', 'error']),
    provider: z.enum(['google', 'curated']),
    summary: CommuteSummarySchema,
    steps: z.array(CommuteStepSchema),
    notices: z.array(CommuteNoticeSchema),
    externalUrl: z.string().url().optional(),
});

export type CommuteResponse = z.infer<typeof CommuteResponseSchema>;

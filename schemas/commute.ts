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

export const CommuteCoordinateSchema = z.object({
    lat: z.number(),
    lng: z.number(),
    label: z.string().optional(),
});

export type CommuteCoordinate = z.infer<typeof CommuteCoordinateSchema>;

export const CommuteWaypointSchema = CommuteCoordinateSchema.extend({
    stepIndex: z.number().int().nonnegative().optional(),
});

export type CommuteWaypoint = z.infer<typeof CommuteWaypointSchema>;

export const CommuteRouteGeometrySchema = z.object({
    type: z.literal('LineString'),
    coordinates: z.array(z.tuple([z.number(), z.number()])).min(2),
});

export type CommuteRouteGeometry = z.infer<typeof CommuteRouteGeometrySchema>;

export const ContributorDisplayModeSchema = z.enum(['nickname', 'real_name', 'masked']);
export type ContributorDisplayMode = z.infer<typeof ContributorDisplayModeSchema>;

export const CommuteVoteTypeSchema = z.enum(['UPVOTE', 'DOWNVOTE']);
export type CommuteVoteType = z.infer<typeof CommuteVoteTypeSchema>;

export const CommuteHealthStatusSchema = z.enum(['healthy', 'aging', 'flagged']);
export type CommuteHealthStatus = z.infer<typeof CommuteHealthStatusSchema>;

export const RouteModerationStatusSchema = z.enum([
    'Pending',
    'Approved',
    'Rejected',
    'Flagged for Review',
    'Approved with Warning',
]);
export type RouteModerationStatus = z.infer<typeof RouteModerationStatusSchema>;

export const RouteModerationActionSchema = z.enum([
    'Approve',
    'Reject',
    'Mark for Review',
    'Approve with Warning',
    'Restore Confidence',
]);
export type RouteModerationAction = z.infer<typeof RouteModerationActionSchema>;

export const LeaderboardEntrySchema = z.object({
    rank: z.number().int().positive(),
    contributorKey: z.string(),
    displayLabel: z.string(),
    approvedRoutes: z.number().int().nonnegative(),
    upvotes: z.number().int().nonnegative(),
    downvotes: z.number().int().nonnegative(),
    points: z.number().int(),
});

export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;

export const ContributorSubmissionStepSchema = z.object({
    type: CommuteStepSchema.shape.type,
    instruction: z.string().trim().min(6, 'Instruction must be at least 6 characters').max(500, 'Instruction must be at most 500 characters'),
});

export type ContributorSubmissionStep = z.infer<typeof ContributorSubmissionStepSchema>;

export const ContributorSubmissionSchema = z.object({
    origin: z.string().trim().min(2, 'Origin must be at least 2 characters').max(200, 'Origin must be at most 200 characters'),
    destination: z.string().trim().min(2, 'Destination must be at least 2 characters').max(200, 'Destination must be at most 200 characters'),
    steps: z.array(ContributorSubmissionStepSchema).min(1, 'At least one step is required').max(4, 'At most four steps are allowed'),
    fareEstimateRange: z.string().trim().max(40, 'Fare range must be at most 40 characters').optional().default(''),
    durationMinutes: z.number().int().min(1, 'Duration must be at least 1 minute').max(1440, 'Duration must be at most 1440 minutes').optional(),
    notes: z.string().trim().max(500, 'Notes must be at most 500 characters').optional().default(''),
    contributorName: z.string().trim().min(2, 'Contributor name must be at least 2 characters').max(120, 'Contributor name must be at most 120 characters'),
    contributorStudentId: z.string().trim().min(4, 'Student ID must be at least 4 characters').max(40, 'Student ID must be at most 40 characters'),
    contributorDisplayMode: ContributorDisplayModeSchema,
    contributorPublicLabel: z.string().trim().max(80, 'Public label must be at most 80 characters').optional().default(''),
});

export type ContributorSubmission = z.infer<typeof ContributorSubmissionSchema>;

export const CommuteVoteSchema = z.object({
    rowNumber: z.number().int().min(2, 'Row number must be at least 2'),
    voteType: CommuteVoteTypeSchema,
});

export type CommuteVote = z.infer<typeof CommuteVoteSchema>;

export const RouteIssueSchema = z.object({
    rowNumber: z.number().int().min(2, 'Row number must be at least 2'),
    reportType: z.enum(['ISSUE', 'UPDATE']).default('ISSUE'),
    message: z.string().trim().min(12, 'Please give officers enough detail to review the route.').max(1000, 'Issue report must be at most 1000 characters'),
});

export type RouteIssue = z.infer<typeof RouteIssueSchema>;

export const CommuteResponseSchema = z.object({
    status: z.enum(['success', 'fallback', 'error']),
    provider: z.enum(['google', 'curated']),
    summary: CommuteSummarySchema,
    steps: z.array(CommuteStepSchema),
    notices: z.array(CommuteNoticeSchema),
    originCoordinate: CommuteCoordinateSchema.optional(),
    destinationCoordinate: CommuteCoordinateSchema.optional(),
    waypoints: z.array(CommuteWaypointSchema).optional(),
    routeGeometry: CommuteRouteGeometrySchema.optional(),
    rowNumber: z.number().int().positive().optional(),
    contributorDisplayLabel: z.string().optional(),
    contributorDisplayMode: ContributorDisplayModeSchema.optional(),
    upvotes: z.number().int().nonnegative().optional(),
    downvotes: z.number().int().nonnegative().optional(),
    healthStatus: CommuteHealthStatusSchema.optional(),
    healthReason: z.string().optional(),
    lastReviewedAt: z.string().optional(),
    reviewBadgeLabel: z.string().optional(),
    externalUrl: z.string().url().optional(),
});

export type CommuteResponse = z.infer<typeof CommuteResponseSchema>;

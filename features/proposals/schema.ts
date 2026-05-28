import { z } from 'zod';

export const ProposalSubmissionSchema = z.object({
  title: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(120),
  projectType: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(5000),
});

export const ProposalCommentSchema = z.object({
  message: z.string().trim().min(2).max(5000),
  trackingToken: z.string().trim().max(256).optional().default(''),
});

export type ProposalSubmissionData = z.output<typeof ProposalSubmissionSchema>;
export type ProposalCommentData = z.output<typeof ProposalCommentSchema>;

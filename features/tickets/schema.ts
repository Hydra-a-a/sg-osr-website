import { z } from 'zod';
import { CAMPUSES, COLLEGE_INSTITUTES, GRIEVANCE_CATEGORIES } from '@/lib/ticket-constants';

const safeText = (max: number) =>
  z.string().trim().max(max).regex(/^[a-zA-Z0-9\s.,!?'"\\-\u00f1\u00d1()&/:@#%+\[\]]*$/, 'Contains invalid characters');

export type AttachmentKind = 'image' | 'document';

export const TicketSubmissionSchema = z.object({
  studentId: z.string().trim().max(40).regex(/^[a-zA-Z0-9-]*$/, 'Student ID format is invalid.').optional().default(''),
  campus: z.enum(CAMPUSES),
  college: z.enum(COLLEGE_INSTITUTES),
  category: z.enum(GRIEVANCE_CATEGORIES),
  subject: safeText(200).optional().default(''),
  complaintNarrative: z.string().trim().min(10, 'Complaint narrative must be at least 10 characters').max(5000).optional(),
  message: z.string().trim().min(10, 'Message must be at least 10 characters').max(5000).optional(),
  attachmentKind: z.enum(['image', 'document']).optional().default('document'),
  attachmentUrl: z.string().url().max(2048).optional(),
  isAnonymous: z.boolean().optional().default(false),
  contactEmail: z.string().email().optional(),
  updatesOptIn: z.boolean().optional().default(false),
  updatesChannel: z.enum(['none', 'email']).optional().default('none'),
  updatesDestination: z.string().email().max(254).optional(),
  updatesNotes: safeText(500).optional().default(''),
  honeypot: z.string().optional(),
  timestamp: z.number().optional(),
}).superRefine((data, ctx) => {
  const narrative = data.complaintNarrative || data.message || '';
  if (!narrative.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['complaintNarrative'],
      message: 'Complaint narrative is required.',
    });
  }

  if (!data.isAnonymous && data.studentId.trim().length < 3) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['studentId'],
      message: 'Student ID is required when anonymous mode is off.',
    });
  }

  if (data.updatesOptIn) {
    if (data.updatesChannel !== 'email') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['updatesChannel'],
        message: 'Optional update channel must be email when opt-in is enabled.',
      });
    }

    if (!data.updatesDestination) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['updatesDestination'],
        message: 'Optional update destination is required when opt-in is enabled.',
      });
    }
  }

  if (!data.updatesOptIn && data.updatesDestination) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['updatesDestination'],
      message: 'Provide optional update destination only when opt-in is enabled.',
    });
  }
});

export type TicketSubmissionInput = z.input<typeof TicketSubmissionSchema>;
export type TicketSubmissionData = z.output<typeof TicketSubmissionSchema>;

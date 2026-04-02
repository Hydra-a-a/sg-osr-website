import { z } from 'zod';
import { isTrustedUrl } from '../lib/security';

// Strict sanitization regex for text content
const safeContentRegex = /^[a-zA-Z0-9\s.,!?'"\-ñÑ()&/:@#%+\[\]]+$/;

// Schema for incoming Make.com Facebook Page payloads
export const MakeWebhookPayloadSchema = z.object({
    // The text content of the Facebook post
    content: z.string()
        .trim()
        .max(10000, "Content exceeds maximum length")
        .optional()
        .default(''),

    // URL to the post's image, if any
    imageUrl: z.union([
        z.string().url("Invalid image URL").startsWith('https://', "URL must start with https://").refine(isTrustedUrl, { message: "Untrusted image source" }).max(2048),
        z.literal(''),
        z.null()
    ]).optional(),

    // Which Facebook page this came from (e.g., "SSC", "OSR", commission names)
    sourcePage: z.string()
        .trim()
        .max(100)
        .regex(safeContentRegex, "Source page contains invalid characters")
        .default('OSR'),

    // Timestamp from Make.com
    publishedAt: z.string()
        .trim()
        .max(100)
        .nullable()
        .optional(),

    // Link back to the Facebook post
    fbLink: z.string().url().optional(),
});

export type MakeWebhookPayload = z.infer<typeof MakeWebhookPayloadSchema>;

// Schema for form submission data
export const FormSubmissionSchema = z.object({
    formType: z.enum(['grievance']),

    name: z.string()
        .trim()
        .max(100, "Name is too long")
        .regex(/^[a-zA-Z\s.',\-ñÑ]*$/, "Name contains invalid characters")
        .optional()
        .default(''),

    email: z.string()
        .trim()
        .email("Invalid email address")
        .max(254, "Email is too long")
        .optional()
        .or(z.literal(''))
        .default(''),

    subject: z.string()
        .trim()
        .min(3, "Subject is too short")
        .max(200, "Subject is too long")
        .optional(),

    message: z.string()
        .trim()
        .min(10, "Message must be at least 10 characters")
        .max(5000, "Message is too long"),

    // Security: Honeypot field (should remain empty)
    honeypot: z.string().optional(),

    // Security: Client-side timestamp to prevent instant bot submissions
    timestamp: z.number().optional(),

    // Security: Allow students to submit grievances without PII attached
    isAnonymous: z.boolean().optional().default(false),
}).superRefine((data, ctx) => {
    if (!data.isAnonymous) {
        if (!data.name || data.name.trim().length < 2) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['name'],
                message: 'Name is required',
            });
        }

        if (!data.email || data.email.trim().length === 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['email'],
                message: 'Email is required',
            });
        }
    }
});

export type FormSubmission = z.infer<typeof FormSubmissionSchema>;

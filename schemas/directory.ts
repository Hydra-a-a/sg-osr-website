import { z } from 'zod';

// Strict sanitization regex: letters, numbers, spaces, common punctuation, Filipino characters
const safeTextRegex = /^[a-zA-Z0-9\s.,'\-ñÑ()&/]+$/;

export const OfficerSchema = z.object({
    id: z.string().trim().max(50).optional(),

    name: z.string()
        .trim()
        .min(2, "Name must be at least 2 characters long")
        .max(100, "Name is too long")
        .regex(safeTextRegex, "Name contains invalid characters"),

    position: z.string()
        .trim()
        .min(2, "Position must be at least 2 characters long")
        .max(150, "Position is too long")
        .regex(safeTextRegex, "Position contains invalid characters"),

    branch: z.string()
        .trim()
        .max(100, "Branch name is too long")
        .regex(safeTextRegex, "Branch contains invalid characters")
        .optional()
        .default(''),

    category: z.string()
        .trim()
        .max(120, "Category is too long")
        .regex(safeTextRegex, "Category contains invalid characters")
        .optional(),

    email: z.string()
        .trim()
        .email('Invalid email address')
        .max(200)
        .optional(),

    facebookUrl: z.string()
        .trim()
        .url("Invalid Facebook URL")
        .startsWith('https://', "URL must start with https://")
        .max(300)
        .optional(),

    linkedinUrl: z.string()
        .trim()
        .url("Invalid LinkedIn URL")
        .startsWith('https://', "URL must start with https://")
        .max(300)
        .optional(),

    priority: z.number().int().min(0).max(999).optional(),
});

export type OfficerData = z.infer<typeof OfficerSchema>;

export const OfficeSchema = z.object({
    id: z.string().trim().max(50).optional(),

    officeName: z.string()
        .trim()
        .min(2, 'Office name must be at least 2 characters long')
        .max(150, 'Office name is too long')
        .regex(safeTextRegex, 'Office name contains invalid characters'),

    location: z.string()
        .trim()
        .max(200, 'Location is too long')
        .regex(safeTextRegex, 'Location contains invalid characters')
        .optional()
        .default(''),

    headDirector: z.string()
        .trim()
        .max(120, 'Head/Director name is too long')
        .regex(safeTextRegex, 'Head/Director contains invalid characters')
        .optional()
        .default(''),

    email: z.string()
        .trim()
        .email('Invalid office email address')
        .max(200)
        .optional(),

    branch: z.string()
        .trim()
        .max(100, 'Branch name is too long')
        .regex(safeTextRegex, 'Branch contains invalid characters')
        .optional()
        .default(''),

    priority: z.number().int().min(0).max(999).optional(),
});

export type OfficeData = z.infer<typeof OfficeSchema>;
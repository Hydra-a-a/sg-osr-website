export const HUB_GUIDE_CATEGORIES = [
    'Student Handbooks & Policies',
    'Academics & Enrollment',
    'Student Government & Organizations',
    'Forms & Processes',
] as const;

export type HubGuideCategory = typeof HUB_GUIDE_CATEGORIES[number];

const LEGACY_STUDENT_HANDBOOK_CATEGORY = 'Student Handbook & Guides';

export function normalizeHubGuideCategory(value: unknown): string {
    const category = String(value || '').trim();
    return !category || category === LEGACY_STUDENT_HANDBOOK_CATEGORY ? HUB_GUIDE_CATEGORIES[0] : category;
}

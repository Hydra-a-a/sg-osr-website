/**
 * Shared ticket constants — safe to import in both Server AND Client components.
 * Contains NO server-only imports (no googleapis, no nodemailer, etc.)
 */

export const GRIEVANCE_CATEGORIES = [
    'Academics',
    'Faculty Conduct',
    'Administrative Services',
    'Facilities & Infrastructure',
    'Student Organizations',
    'Financial Concerns',
    'Safety & Security',
    'Other',
] as const;

export const CAMPUSES = [
    'Boni',
    'Pasig',
] as const;

export const COLLEGE_INSTITUTES = [
    'College of Engineering (CEng)',
    'College of Business, Entrepreneurship, and Accountancy (CBEA)',
    'College of Arts and Sciences (CAS)',
    'College of Education (CEd)',
    'Institute of Human Kinetics (IHK)',
    'Institute of Architecture (IA)',
    'Institute of Computer Studies (ICS)',
] as const;

export type GrievanceCategory = typeof GRIEVANCE_CATEGORIES[number];
export type Campus = typeof CAMPUSES[number];
export type CollegeInstitute = typeof COLLEGE_INSTITUTES[number];

export type TicketStatus = 'Open' | 'In Progress' | 'Resolved' | 'Closed';

import type { StoredTicket } from '@/components/track/types';

const STORAGE_KEY = 'osr_submitted_tickets';
const ACCESS_TOKEN_STORAGE_KEY = 'osr_ticket_access_tokens';
const FAKE_TICKET_ID = 'TKT-0000-FAKE';

function loadStoredTickets(): StoredTicket[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) as StoredTicket[] : [];
        return parsed.filter((ticket) => ticket.id.toUpperCase() !== FAKE_TICKET_ID);
    } catch {
        return [];
    }
}

function loadStoredAccessTokens(): Record<string, string> {
    try {
        const raw = sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
        return raw ? JSON.parse(raw) as Record<string, string> : {};
    } catch {
        return {};
    }
}

function saveStoredAccessToken(ticketId: string, accessToken: string): void {
    const normalizedTicketId = ticketId.trim().toUpperCase();
    const normalizedToken = accessToken.trim();
    if (!normalizedTicketId || !normalizedToken) return;

    try {
        const existing = loadStoredAccessTokens();
        existing[normalizedTicketId] = normalizedToken;
        sessionStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, JSON.stringify(existing));
    } catch {
        // session storage unavailable
    }
}

export function saveTicketToHistory(ticket: StoredTicket, accessToken?: string): void {
    try {
        if (ticket.id.toUpperCase() === FAKE_TICKET_ID) return;
        if (accessToken) saveStoredAccessToken(ticket.id, accessToken);

        const existing = loadStoredTickets();
        if (existing.some((current) => current.id === ticket.id)) return;
        localStorage.setItem(STORAGE_KEY, JSON.stringify([ticket, ...existing].slice(0, 10)));
    } catch {
        // local storage unavailable
    }
}

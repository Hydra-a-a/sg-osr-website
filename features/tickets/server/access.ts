import {
    listTicketsByOwnerEmail as listTicketsByOwnerEmailFromLib,
    lookupTicketByIdForOwner as lookupTicketByIdForOwnerFromLib,
} from '@/lib/tickets';

export function lookupTicketByIdForOwner(
    ticketId: string,
    options?: {
        trackingToken?: string | null;
        ownerEmail?: string | null;
    }
) {
    return lookupTicketByIdForOwnerFromLib(ticketId, options);
}

export function listTicketsByOwnerEmail(ownerEmail: string) {
    return listTicketsByOwnerEmailFromLib(ownerEmail);
}

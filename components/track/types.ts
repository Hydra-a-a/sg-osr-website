export interface StoredTicket {
    id: string;
    submittedAt: string;
    category: string;
    subject: string;
}

export interface TrackTicket {
    ticketId: string;
    status: string;
    submittedAt: string;
    detailsRedacted: boolean;
    studentId: string;
    campus: string;
    college: string;
    category: string;
    subject: string;
    complaintNarrative: string;
    attachmentUrl: string;
    resolutionNotes: string;
}

export interface TrackStep {
    label: string;
    description: string;
    activeFor: string[];
}

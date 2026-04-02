export type GoogleFormType = 'grievance';

export interface GrievanceFormData {
    name?: string;
    email?: string;
    subject?: string;
    message?: string;
}

type GoogleFormDataByType = {
    grievance: GrievanceFormData;
};

export async function submitToGoogleForm<T extends GoogleFormType>(formType: T, data: GoogleFormDataByType[T]) {
    const formConfigs: Record<GoogleFormType, { url?: string; entries: Record<string, string> }> = {
        grievance: {
            url: process.env.GOOGLE_FORM_GRIEVANCE_URL,
            entries: {
                name: process.env.GOOGLE_FORM_GRIEVANCE_NAME || 'entry.111111',
                email: process.env.GOOGLE_FORM_GRIEVANCE_EMAIL || 'entry.222222',
                subject: process.env.GOOGLE_FORM_GRIEVANCE_SUBJECT || 'entry.333333',
                message: process.env.GOOGLE_FORM_GRIEVANCE_MESSAGE || 'entry.444444',
            }
        }
    };

    const config = formConfigs[formType];

    if (!config || !config.url) {
        throw new Error(`Missing Google Form configuration for ${formType}. Set GOOGLE_FORM_${formType.toUpperCase()}_URL.`);
    }

    const formData = new URLSearchParams();
    if (data.name) formData.append(config.entries.name, data.name);
    if (data.email) formData.append(config.entries.email, data.email);
    if (data.subject) formData.append(config.entries.subject, data.subject);
    if (data.message) formData.append(config.entries.message, data.message);

    const googleRes = await fetch(config.url, {
        method: 'POST',
        body: formData,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    });

    if (!googleRes.ok) {
        throw new Error('Google Forms responded with an error');
    }

    return true;
}

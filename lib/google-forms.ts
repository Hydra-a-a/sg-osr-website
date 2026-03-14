export async function submitToGoogleForm(formType: string, data: any) {
    const formConfigs: Record<string, { url?: string; entries: Record<string, string> }> = {
        grievance: {
            url: process.env.GOOGLE_FORM_GRIEVANCE_URL,
            entries: {
                name: process.env.GOOGLE_FORM_GRIEVANCE_NAME || 'entry.111111',
                email: process.env.GOOGLE_FORM_GRIEVANCE_EMAIL || 'entry.222222',
                subject: process.env.GOOGLE_FORM_GRIEVANCE_SUBJECT || 'entry.333333',
                message: process.env.GOOGLE_FORM_GRIEVANCE_MESSAGE || 'entry.444444',
            }
        },
        feedback: {
            url: process.env.GOOGLE_FORM_FEEDBACK_URL,
            entries: {
                name: process.env.GOOGLE_FORM_FEEDBACK_NAME || 'entry.111111',
                email: process.env.GOOGLE_FORM_FEEDBACK_EMAIL || 'entry.222222',
                subject: process.env.GOOGLE_FORM_FEEDBACK_SUBJECT || 'entry.333333',
                message: process.env.GOOGLE_FORM_FEEDBACK_MESSAGE || 'entry.444444',
            }
        },
        contact: {
            url: process.env.GOOGLE_FORM_CONTACT_URL,
            entries: {
                name: process.env.GOOGLE_FORM_CONTACT_NAME || 'entry.111111',
                email: process.env.GOOGLE_FORM_CONTACT_EMAIL || 'entry.222222',
                subject: process.env.GOOGLE_FORM_CONTACT_SUBJECT || 'entry.333333',
                message: process.env.GOOGLE_FORM_CONTACT_MESSAGE || 'entry.444444',
            }
        }
    };

    const config = formConfigs[formType as keyof typeof formConfigs];

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

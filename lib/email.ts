import nodemailer from 'nodemailer';

// Standard Nodemailer transporter using Gmail SMTP
export const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD,
    },
});

export async function sendEmail({
    to,
    subject,
    html,
    text
}: {
    to: string;
    subject: string;
    html?: string;
    text?: string;
}) {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
        console.warn('[Email Warning] EMAIL_USER or EMAIL_APP_PASSWORD is not set. Skipping email dispatch.');
        return false;
    }

    try {
        const info = await transporter.sendMail({
            from: `"RTU Student Government" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            text,
            html,
        });
        console.log(`[Email Success] Sent to ${to}. Message ID: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error('[Email Error] Failed to send email:', error);
        return false;
    }
}

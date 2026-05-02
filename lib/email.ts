import nodemailer from 'nodemailer';
import { redactErrorForLog } from '@/lib/security';

// Standard Nodemailer transporter using Gmail SMTP
export const transporter = nodemailer.createTransport({
    service: 'gmail',
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD,
    },
});

export async function sendEmail({
    to,
    cc,
    replyTo,
    from,
    subject,
    html,
    text
}: {
    to: string;
    cc?: string | string[];
    replyTo?: string;
    from?: string;
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
            from: from || process.env.EMAIL_NOTIFICATIONS_FROM || `"RTU Student Government" <${process.env.EMAIL_USER}>`,
            to,
            cc,
            replyTo,
            subject,
            text,
            html,
        });
        console.log(`[Email Success] Sent to ${to}. Message ID: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error('[Email Error] Failed to send email:', redactErrorForLog(error));
        return false;
    }
}

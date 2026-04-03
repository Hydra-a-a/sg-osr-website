/**
 * Email HTML templates for the RTU Student Government ticketing system.
 * These templates produce branded, responsive emails using table-based layouts
 * for maximum email client compatibility.
 */
import { escapeHtml, sanitizeRichText } from '@/lib/security';

const RTU_RED = '#8B1A1A';
const RTU_GOLD = '#C8973A';

interface ConfirmationTemplateProps {
    ticketId: string;
  studentId: string;
    name: string;           // 'Anonymous Student' if anonymous
  campus: string;
  college: string;
    category: string;
    subject: string;
  complaintNarrative: string;
  attachmentUrl: string;
    submittedAt: string;    // ISO string, formatted by the template
    trackingUrl: string;    // Full URL to the /services/track?id=... page
}

interface RegentAlertTemplateProps extends ConfirmationTemplateProps {
    isAnonymous: boolean;
    submitterEmail: string; // original email for regent visibility
}

function isTrustedAttachmentUrl(rawUrl: string): boolean {
  const candidate = rawUrl.trim();
  if (!candidate) return false;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return host === 'drive.google.com' || host === 'docs.google.com';
  } catch {
    return false;
  }
}

/** Shared HTML shell used by both templates. */
function emailShell(title: string, body: string): string {
    const safeTitle = escapeHtml(title);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${safeTitle}</title>
  <style>
    @media only screen and (max-width: 640px) {
      .email-shell {
        width: 100% !important;
        border-radius: 0 !important;
      }

      .email-content {
        padding: 24px 18px !important;
      }

      .email-header {
        padding: 22px 18px !important;
      }

      .ticket-id-value {
        font-size: 28px !important;
        letter-spacing: 1px !important;
      }

      .info-label,
      .info-value {
        display: block !important;
        width: auto !important;
      }

      .info-label {
        padding: 10px 12px 4px !important;
      }

      .info-value {
        padding: 0 12px 10px !important;
      }

      .cta-col {
        display: block !important;
        width: 100% !important;
        padding: 0 0 10px !important;
      }

      .cta-col:last-child {
        padding-bottom: 0 !important;
      }

      .cta-btn {
        width: 100% !important;
        min-width: 0 !important;
        box-sizing: border-box !important;
      }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" class="email-shell" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td class="email-header" style="background:${RTU_RED};padding:28px 40px;">
              <p style="margin:0;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.6);">Rizal Technological University</p>
              <h1 style="margin:4px 0 0;font-size:22px;color:#ffffff;font-weight:700;">Student Government Portal</h1>
            </td>
          </tr>

          <!-- Gold divider -->
          <tr><td style="height:4px;background:${RTU_GOLD};"></td></tr>

          <!-- Body -->
          <tr>
            <td class="email-content" style="padding:36px 40px;">
              ${body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9f9f9;padding:20px 40px;border-top:1px solid #e8e8e8;">
              <p style="margin:0;font-size:11px;color:#999;">This is an automated message from the RTU Student Government Portal. Do not reply to this email directly.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Helper: renders a labeled info row (used in both templates). */
function infoRow(label: string, value: string, options?: { allowHtml?: boolean }): string {
    const safeLabel = escapeHtml(label);
    const renderedValue = options?.allowHtml ? value : escapeHtml(value);

    return `
      <tr>
        <td class="info-label" style="padding:10px 14px;font-size:12px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;width:132px;vertical-align:top;line-height:1.45;">${safeLabel}</td>
        <td class="info-value" style="padding:10px 14px;font-size:14px;color:#1a1a1a;line-height:1.45;word-break:break-word;">${renderedValue}</td>
      </tr>`;
}

/**
 * Student auto-responder: confirms receipt and provides the Tracking ID
 * along with a direct link to check status.
 */
export function buildStudentConfirmationEmail(props: ConfirmationTemplateProps): string {
    const date = new Date(props.submittedAt).toLocaleString('en-PH', {
        timeZone: 'Asia/Manila',
        dateStyle: 'long',
        timeStyle: 'short',
    });

    const safeTicketId = escapeHtml(props.ticketId);
    const safeName = escapeHtml(props.name);
    const safeTrackingUrl = escapeHtml(props.trackingUrl);
    const subjectText = props.subject.trim().length > 0 ? props.subject : '(No subject)';
    const messagePreview = props.complaintNarrative.length > 500
      ? `${props.complaintNarrative.slice(0, 500)}...`
      : props.complaintNarrative;
    const safeMessagePreview = sanitizeRichText(messagePreview);

    const body = `
      <h2 style="margin:0 0 6px;font-size:20px;color:${RTU_RED};">Grievance Received</h2>
      <p style="margin:0 0 24px;font-size:15px;color:#444;">Hi <strong>${safeName}</strong>, your submission was received and is now being tracked.</p>

      <!-- Ticket ID hero -->
      <div style="background:#fdf5e6;border:2px dashed ${RTU_GOLD};border-radius:8px;padding:20px;text-align:center;margin-bottom:28px;">
        <p style="margin:0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px;">Your Ticket ID</p>
        <p style="margin:6px 0 0;font-size:28px;font-weight:700;color:${RTU_RED};letter-spacing:3px;">${safeTicketId}</p>
        <p style="margin:8px 0 0;font-size:12px;color:#888;">Save this ID to track your grievance status.</p>
      </div>

      <!-- Submission summary -->
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e8e8;border-radius:6px;border-collapse:collapse;margin-bottom:28px;">
        <tbody>
          ${infoRow('Student ID', props.studentId)}
          <tr><td colspan="2" style="border-top:1px solid #f0f0f0;"></td></tr>
          ${infoRow('Campus', props.campus)}
          <tr><td colspan="2" style="border-top:1px solid #f0f0f0;"></td></tr>
          ${infoRow('College', props.college)}
          <tr><td colspan="2" style="border-top:1px solid #f0f0f0;"></td></tr>
          ${infoRow('Category', props.category)}
          <tr><td colspan="2" style="border-top:1px solid #f0f0f0;"></td></tr>
          ${infoRow('Subject', subjectText)}
          <tr><td colspan="2" style="border-top:1px solid #f0f0f0;"></td></tr>
          ${infoRow('Submitted', date)}
          <tr><td colspan="2" style="border-top:1px solid #f0f0f0;"></td></tr>
          ${infoRow('Status', '<span style="background:#fef9c3;color:#854d0e;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:700;">Open</span>', { allowHtml: true })}
        </tbody>
      </table>

      <!-- Message preview -->
      <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:0.5px;">Complaint Narrative</p>
      <blockquote style="margin:0 0 28px;padding:14px 16px;background:#f8f8f8;border-left:4px solid ${RTU_RED};border-radius:0 6px 6px 0;font-size:14px;color:#333;line-height:1.6;">${safeMessagePreview}</blockquote>

      <!-- CTA button -->
      <div style="text-align:center;margin-bottom:24px;">
        <a href="${safeTrackingUrl}" style="display:inline-block;background:${RTU_RED};color:#ffffff;padding:13px 32px;border-radius:6px;text-decoration:none;font-weight:700;font-size:15px;">Track My Ticket →</a>
      </div>

      <p style="margin:0;font-size:13px;color:#666;line-height:1.6;">You will be notified by email when the status of your ticket changes. The Student Regent typically responds within <strong>3–5 working days</strong>.</p>
    `;

    return emailShell('Your Grievance Has Been Received', body);
}

/**
 * Student Regent alert: full details including original submitter email,
 * all ticket metadata, and a direct link to the Google Sheet.
 */
export function buildRegentAlertEmail(props: RegentAlertTemplateProps, sheetUrl: string): string {
    const date = new Date(props.submittedAt).toLocaleString('en-PH', {
        timeZone: 'Asia/Manila',
        dateStyle: 'long',
        timeStyle: 'short',
    });

  const safeTicketId = escapeHtml(props.ticketId);
  const safeMessage = sanitizeRichText(props.complaintNarrative);
  const safeTrackingUrl = escapeHtml(props.trackingUrl);
  const safeSheetUrl = escapeHtml(sheetUrl);
  const hasAttachment = isTrustedAttachmentUrl(props.attachmentUrl || '');
  const safeAttachmentUrl = hasAttachment ? escapeHtml(props.attachmentUrl) : '';
  const subjectText = props.subject.trim().length > 0 ? props.subject : '(No subject)';
  const studentDisplay = props.isAnonymous
    ? '<em style="color:#888;">Anonymous</em>'
    : escapeHtml(props.name);
  const submitterDisplay = props.isAnonymous
    ? '<em style="color:#888;">Anonymous</em>'
    : `<a href="${escapeHtml(`mailto:${encodeURIComponent(props.submitterEmail)}`)}" style="color:${RTU_RED};">${escapeHtml(props.submitterEmail)}</a>`;

    const body = `
      <h2 style="margin:0 0 6px;font-size:20px;color:${RTU_RED};">New Grievance Filed</h2>
      <p style="margin:0 0 24px;font-size:15px;color:#444;">A new student grievance has been submitted and requires your attention.</p>

      <!-- Ticket ID hero -->
      <div style="background:#fdf5e6;border:2px dashed ${RTU_GOLD};border-radius:8px;padding:18px 16px;text-align:center;margin-bottom:28px;">
        <p style="margin:0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px;">Ticket ID</p>
        <p class="ticket-id-value" style="margin:6px 0 0;font-size:34px;font-weight:700;color:${RTU_RED};letter-spacing:2px;line-height:1.2;">${safeTicketId}</p>
      </div>

      <!-- Full ticket details for regent -->
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e8e8;border-radius:6px;border-collapse:collapse;margin-bottom:28px;table-layout:fixed;">
        <tbody>
          ${infoRow('Student ID', props.studentId)}
          <tr><td colspan="2" style="border-top:1px solid #f0f0f0;"></td></tr>
          ${infoRow('Campus', props.campus)}
          <tr><td colspan="2" style="border-top:1px solid #f0f0f0;"></td></tr>
          ${infoRow('College', props.college)}
          <tr><td colspan="2" style="border-top:1px solid #f0f0f0;"></td></tr>
          ${infoRow('Category', props.category)}
          <tr><td colspan="2" style="border-top:1px solid #f0f0f0;"></td></tr>
          ${infoRow('Subject', subjectText)}
          <tr><td colspan="2" style="border-top:1px solid #f0f0f0;"></td></tr>
          ${infoRow('Submitted', date)}
          <tr><td colspan="2" style="border-top:1px solid #f0f0f0;"></td></tr>
          ${infoRow('Student', studentDisplay, { allowHtml: true })}
          <tr><td colspan="2" style="border-top:1px solid #f0f0f0;"></td></tr>
          ${infoRow('Email', submitterDisplay, { allowHtml: true })}
          <tr><td colspan="2" style="border-top:1px solid #f0f0f0;"></td></tr>
          ${infoRow('Status', '<span style="background:#fef9c3;color:#854d0e;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:700;">Open</span>', { allowHtml: true })}
        </tbody>
      </table>

      <!-- Full message -->
      <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:0.5px;">Complaint Narrative</p>
      <blockquote style="margin:0 0 28px;padding:14px 16px;background:#f8f8f8;border-left:4px solid ${RTU_RED};border-radius:0 6px 6px 0;font-size:14px;color:#333;line-height:1.6;">${safeMessage}</blockquote>

      ${hasAttachment ? `
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 16px;">
        <tr>
          <td align="center" style="padding:0;">
            <a href="${safeAttachmentUrl}" style="display:inline-block;background:${RTU_GOLD};color:#1f1f1f;padding:12px 26px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;">View Attachment</a>
          </td>
        </tr>
      </table>
      ` : ''}

      <!-- CTA buttons -->
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 24px;">
        <tr>
          <td class="cta-col" width="50%" align="center" style="padding:0 6px 0 0;">
            <a href="${safeSheetUrl}" class="cta-btn" style="display:inline-block;min-width:240px;background:${RTU_RED};color:#ffffff;padding:13px 24px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;text-align:center;">Open in Google Sheets →</a>
          </td>
          <td class="cta-col" width="50%" align="center" style="padding:0 0 0 6px;">
            <a href="${safeTrackingUrl}" class="cta-btn" style="display:inline-block;min-width:240px;background:#ffffff;color:${RTU_RED};border:2px solid ${RTU_RED};padding:11px 24px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;text-align:center;">View Ticket Status Page</a>
          </td>
        </tr>
      </table>

      <p style="margin:0;font-size:13px;color:#666;line-height:1.6;">To update the status and add resolution notes, update the <strong>Status</strong> and <strong>Resolution Notes</strong> columns directly in Google Sheets. Changes will be reflected to the student immediately.</p>
    `;

    return emailShell(`[New Ticket ${props.ticketId}] ${props.category} Grievance`, body);
}

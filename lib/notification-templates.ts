import { escapeHtml, sanitizeRichText } from '@/lib/security';

const RTU_RED = '#8B1A1A';
const RTU_GOLD = '#C8973A';

interface InfoRow {
    label: string;
    value: string;
    allowHtml?: boolean;
}

interface ActionLink {
    href: string;
    label: string;
    tone?: 'primary' | 'secondary' | 'gold';
}

interface NotificationEmailOptions {
    title: string;
    eyebrow?: string;
    intro: string;
    heroLabel: string;
    heroValue: string;
    infoRows?: InfoRow[];
    bodyLabel?: string;
    bodyHtml?: string;
    actions?: ActionLink[];
    footerNote?: string;
}

function shell(title: string, body: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    @media only screen and (max-width: 640px) {
      .email-shell { width: 100% !important; border-radius: 0 !important; }
      .email-content { padding: 24px 18px !important; }
      .email-header { padding: 22px 18px !important; }
      .hero-value { font-size: 26px !important; letter-spacing: 1px !important; }
      .action-cell { display: block !important; width: 100% !important; padding: 0 0 10px !important; }
      .action-link { width: 100% !important; min-width: 0 !important; box-sizing: border-box !important; }
      .info-label, .info-value { display: block !important; width: auto !important; }
      .info-label { padding: 10px 12px 4px !important; }
      .info-value { padding: 0 12px 10px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" class="email-shell" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td class="email-header" style="background:${RTU_RED};padding:28px 40px;">
              <p style="margin:0;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.6);">Rizal Technological University</p>
              <h1 style="margin:4px 0 0;font-size:22px;color:#ffffff;font-weight:700;">Student Government Portal</h1>
            </td>
          </tr>
          <tr><td style="height:4px;background:${RTU_GOLD};"></td></tr>
          <tr>
            <td class="email-content" style="padding:36px 40px;">
              ${body}
            </td>
          </tr>
          <tr>
            <td style="background:#f9f9f9;padding:20px 40px;border-top:1px solid #e8e8e8;">
              <p style="margin:0;font-size:11px;color:#999;">This is an automated message from the RTU Student Government Portal.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function renderInfoRows(rows: InfoRow[]): string {
    if (rows.length === 0) {
        return '';
    }

    const renderedRows = rows.map((row, index) => {
        const value = row.allowHtml ? row.value : escapeHtml(row.value);
        const divider = index < rows.length - 1
            ? '<tr><td colspan="2" style="border-top:1px solid #f0f0f0;"></td></tr>'
            : '';

        return `
          <tr>
            <td class="info-label" style="padding:10px 14px;font-size:12px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;width:140px;vertical-align:top;line-height:1.45;">${escapeHtml(row.label)}</td>
            <td class="info-value" style="padding:10px 14px;font-size:14px;color:#1a1a1a;line-height:1.45;word-break:break-word;">${value}</td>
          </tr>
          ${divider}`;
    }).join('');

    return `
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e8e8;border-radius:6px;border-collapse:collapse;margin-bottom:24px;">
        <tbody>${renderedRows}</tbody>
      </table>`;
}

function renderActions(actions: ActionLink[]): string {
    if (actions.length === 0) {
        return '';
    }

    const actionCells = actions.map((action, index) => {
        const background = action.tone === 'secondary'
            ? '#ffffff'
            : action.tone === 'gold'
                ? RTU_GOLD
                : RTU_RED;
        const color = action.tone === 'secondary' ? RTU_RED : action.tone === 'gold' ? '#1f1f1f' : '#ffffff';
        const border = action.tone === 'secondary' ? `2px solid ${RTU_RED}` : 'none';
        const padding = action.tone === 'secondary' ? '11px 24px' : '13px 24px';
        const leftPadding = index === 0 ? '0 6px 0 0' : '0 0 0 6px';
        const width = `${Math.floor(100 / actions.length)}%`;

        return `
          <td class="action-cell" width="${width}" align="center" style="padding:${leftPadding};">
            <a href="${escapeHtml(action.href)}" class="action-link" style="display:inline-block;min-width:220px;background:${background};color:${color};${border !== 'none' ? `border:${border};` : ''}padding:${padding};border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;text-align:center;">${escapeHtml(action.label)}</a>
          </td>`;
    }).join('');

    return `
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 24px;">
        <tr>${actionCells}</tr>
      </table>`;
}

function renderBodyBlock(label: string, html: string): string {
    return `
      <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:0.5px;">${escapeHtml(label)}</p>
      <blockquote style="margin:0 0 24px;padding:14px 16px;background:#f8f8f8;border-left:4px solid ${RTU_RED};border-radius:0 6px 6px 0;font-size:14px;color:#333;line-height:1.6;">${html}</blockquote>`;
}

export function buildNotificationEmail(options: NotificationEmailOptions): string {
    const infoRows = renderInfoRows(options.infoRows || []);
    const bodyBlock = options.bodyLabel && options.bodyHtml
        ? renderBodyBlock(options.bodyLabel, options.bodyHtml)
        : '';
    const actions = renderActions(options.actions || []);
    const eyebrow = options.eyebrow
        ? `<p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:1px;">${escapeHtml(options.eyebrow)}</p>`
        : '';

    const body = `
      ${eyebrow}
      <h2 style="margin:0 0 6px;font-size:20px;color:${RTU_RED};">${escapeHtml(options.title)}</h2>
      <p style="margin:0 0 24px;font-size:15px;color:#444;">${options.intro}</p>

      <div style="background:#fdf5e6;border:2px dashed ${RTU_GOLD};border-radius:8px;padding:20px;text-align:center;margin-bottom:24px;">
        <p style="margin:0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px;">${escapeHtml(options.heroLabel)}</p>
        <p class="hero-value" style="margin:6px 0 0;font-size:28px;font-weight:700;color:${RTU_RED};letter-spacing:2px;line-height:1.2;">${escapeHtml(options.heroValue)}</p>
      </div>

      ${infoRows}
      ${bodyBlock}
      ${actions}
      <p style="margin:0;font-size:13px;color:#666;line-height:1.6;">${options.footerNote ? escapeHtml(options.footerNote) : 'Use the tracker link to review the latest status and continue the conversation when needed.'}</p>`;

    return shell(options.title, body);
}

export function htmlQuote(value: string): string {
    return sanitizeRichText(value.trim() || 'No additional details were provided.');
}

export function safeMailto(value: string): string {
    const normalized = String(value || '').trim();
    if (!normalized) {
        return '';
    }

    return `mailto:${encodeURIComponent(normalized)}`;
}

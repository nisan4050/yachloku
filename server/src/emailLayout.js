import { escapeHtml } from './mail.js';

// Shared look for every outgoing email.
// Built for email clients, not browsers: table layout, inline styles, a 600px
// column that becomes full width on phones, and Outlook (MSO) fallbacks.
// Gmail drops <html>/<body> attributes, so direction is stated on every block.

const { APP_URL = 'https://www.yachloku.com' } = process.env;

export const COLORS = {
  brand: '#1f9d6e',
  brandDark: '#17805a',
  brandSoft: '#f4faf7',
  brandBorder: '#cfe9dd',
  page: '#eef5f1',
  card: '#ffffff',
  text: '#1c2b25',
  muted: '#6b7c75',
  faint: '#8a9892',
  line: '#e3ece8',
};

export const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,'Helvetica Neue',sans-serif";
const RTL = 'direction:rtl;text-align:right;';
const LTR = 'direction:ltr;text-align:left;';

const block = (dir) => (dir === 'ltr' ? `dir="ltr" align="left"` : `dir="rtl" align="right"`);
const flow = (dir) => (dir === 'ltr' ? LTR : RTL);

/** A body paragraph. `html` must already be escaped. */
export function paragraph(html, { dir = 'rtl', size = 16, color = COLORS.text, style = '' } = {}) {
  return `<p ${block(dir)} style="${flow(dir)}margin:0 0 16px;font-family:${FONT};font-size:${size}px;line-height:1.65;color:${color};${style}">${html}</p>`;
}

/** Small grey text, for notes and disclaimers. */
export const note = (html, opts = {}) => paragraph(html, { size: 13, color: COLORS.muted, ...opts });

/**
 * A call-to-action button that works in Outlook too (VML), and stretches to
 * full width on phones so it is easy to tap.
 */
export function button(label, href, { variant = 'solid' } = {}) {
  const url = escapeHtml(href);
  const text = escapeHtml(label);
  const solid = variant === 'solid';
  const bg = solid ? COLORS.brand : COLORS.card;
  const fg = solid ? '#ffffff' : COLORS.brand;
  const border = solid ? COLORS.brand : COLORS.brandBorder;
  return `<table role="presentation" dir="rtl" cellpadding="0" cellspacing="0" border="0" class="btn-table" style="direction:rtl;margin:4px 0 20px">
  <tr><td align="center" class="btn-cell" style="border-radius:12px;background:${bg};mso-padding-alt:0">
    <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${url}" style="height:48px;v-text-anchor:middle;width:240px" arcsize="25%" strokecolor="${border}" fillcolor="${bg}"><center style="color:${fg};font-family:Arial,sans-serif;font-size:16px;font-weight:bold">${text}</center></v:roundrect><![endif]-->
    <!--[if !mso]><!-- --><a href="${url}" target="_blank" class="btn" style="display:inline-block;padding:14px 28px;border:1px solid ${border};border-radius:12px;background:${bg};color:${fg};font-family:${FONT};font-size:16px;font-weight:700;line-height:20px;text-decoration:none;mso-hide:all">${text}</a><!--<![endif]-->
  </td></tr>
</table>`;
}

/** A soft green box, for quoting a message or highlighting details. */
export function callout(html) {
  return `<table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" border="0" style="direction:rtl;margin:0 0 20px">
  <tr><td dir="rtl" align="right" style="${RTL}background:${COLORS.brandSoft};border-right:4px solid ${COLORS.brand};border-radius:10px;padding:16px 18px;font-family:${FONT};font-size:16px;line-height:1.7;color:${COLORS.text}">${html}</td></tr>
</table>`;
}

/** A thin divider line. */
export const divider = () =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px"><tr><td style="border-top:1px solid ${COLORS.line};font-size:0;line-height:0;height:1px">&nbsp;</td></tr></table>`;

/**
 * Wraps content in the full email document.
 * @param {object} o
 * @param {string} o.title      Shown in the green header (plain text).
 * @param {string} [o.subtitle] Second line in the header (plain text).
 * @param {string} [o.preheader] Inbox preview text (plain text).
 * @param {string} o.body       Inner HTML, built with the helpers above.
 * @param {string} [o.footer]   Extra footer line (HTML, already escaped).
 */
export function renderEmail({ title, subtitle = '', preheader = '', body, footer = '' }) {
  const appUrl = escapeHtml(APP_URL);
  const appHost = escapeHtml(APP_URL.replace(/^https?:\/\//, '').replace(/\/$/, ''));
  // Padding after the preheader stops clients from pulling body text into the preview.
  const preheaderHtml = preheader
    ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">${escapeHtml(preheader)}${'&#8204;&nbsp;'.repeat(60)}</div>`
    : '';

  return `<!doctype html>
<html lang="he" dir="rtl" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no,address=no,email=no,date=no">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(title)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
  body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
  table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}
  body{margin:0!important;padding:0!important;width:100%!important}
  a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}
  @media only screen and (max-width:620px){
    .outer{padding:12px 8px!important}
    .container{width:100%!important;max-width:100%!important;border-radius:14px!important}
    .px{padding-left:20px!important;padding-right:20px!important}
    .hdr-title{font-size:20px!important}
    .btn-table{width:100%!important}
    .btn-cell{display:block!important;width:100%!important}
    .btn{display:block!important;padding:15px 12px!important;text-align:center!important}
  }
</style>
</head>
<body dir="rtl" style="${RTL}margin:0;padding:0;width:100%;background:${COLORS.page};font-family:${FONT};color:${COLORS.text}">
${preheaderHtml}
<table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" border="0" style="direction:rtl;background:${COLORS.page}">
  <tr><td align="center" class="outer" style="padding:28px 12px">
    <!--[if mso]><table role="presentation" dir="rtl" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
    <table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" border="0" class="container" style="direction:rtl;width:100%;max-width:600px;background:${COLORS.card};border-radius:18px;overflow:hidden;border:1px solid ${COLORS.line}">
      <tr><td dir="rtl" align="right" class="px" style="${RTL}background:${COLORS.brand};background-image:linear-gradient(135deg,${COLORS.brand},${COLORS.brandDark});padding:24px 32px;color:#ffffff">
        <div dir="rtl" style="${RTL}font-family:${FONT};font-size:15px;font-weight:700;letter-spacing:.3px;color:#e6f6ee">יחלוקו</div>
        <div dir="rtl" class="hdr-title" style="${RTL}font-family:${FONT};font-size:23px;font-weight:700;line-height:1.35;margin-top:6px;color:#ffffff">${escapeHtml(title)}</div>
        ${subtitle ? `<div dir="rtl" style="${RTL}font-family:${FONT};font-size:14px;line-height:1.5;margin-top:4px;color:#e6f6ee">${escapeHtml(subtitle)}</div>` : ''}
      </td></tr>
      <tr><td dir="rtl" align="right" class="px" style="${RTL}padding:28px 32px 12px">
        ${body}
      </td></tr>
      <tr><td dir="rtl" align="right" class="px" style="${RTL}padding:16px 32px 24px;border-top:1px solid ${COLORS.line};background:#fafcfb">
        ${footer ? `<div dir="rtl" style="${RTL}font-family:${FONT};font-size:12.5px;line-height:1.6;color:${COLORS.faint};margin-bottom:6px">${footer}</div>` : ''}
        <div dir="rtl" style="${RTL}font-family:${FONT};font-size:12.5px;line-height:1.6;color:${COLORS.faint}">יחלוקו · ניהול הוצאות משותפות בטיולים ובאירועים · <a href="${appUrl}" target="_blank" style="color:${COLORS.brand};text-decoration:none"><bdi>${appHost}</bdi></a></div>
      </td></tr>
    </table>
    <!--[if mso]></td></tr></table><![endif]-->
  </td></tr>
</table>
</body>
</html>`;
}

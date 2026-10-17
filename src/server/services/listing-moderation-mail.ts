import { getListingRewardConfig, getServerRuntime } from '../utils/runtime-config';
import { sendMailSafe } from './email.service';

const DUP_MESSAGE =
  'This looks like a listing we already have. We emailed you. No points until a unique listing is approved.';

function wrap(body: string): string {
  return `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a;max-width:560px">
    <p>Hi,</p>
    ${body}
    <p style="margin-top:24px">— Roomzo</p>
  </div>`;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function adminInbox(): string[] {
  return getServerRuntime()
    .adminEmails.split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((email) => email.includes('@'));
}

async function sendUserMailAndCopyAdmin(opts: {
  to?: string | null;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  const admins = adminInbox();
  const user = String(opts.to || '')
    .trim()
    .toLowerCase();
  const userOk = user.includes('@');
  const to = userOk ? [user] : admins;
  const bcc = userOk ? admins.filter((email) => email !== user) : [];
  if (!to.length) {
    console.warn('[mail] no user or ADMIN_EMAIL for listing mail:', opts.subject);
    return;
  }
  await sendMailSafe({
    to,
    bcc: bcc.length ? bcc : undefined,
    subject: userOk ? opts.subject : `[No owner email] ${opts.subject}`,
    text: opts.text,
    html: opts.html,
  });
}

export async function emailAdminListingPending(opts: {
  listingId: number;
  propertyName?: string | null;
  city?: string | null;
  state?: string | null;
  rentAmount?: number | null;
  ownerName?: string | null;
  ownerEmail?: string | null;
  ownerPhone?: string | null;
  duplicateFlag?: string | null;
}): Promise<void> {
  const to = adminInbox();
  if (!to.length) {
    console.warn('[mail] ADMIN_EMAIL is empty; skipped listing approval alert');
    return;
  }

  const cfg = getServerRuntime();
  const site = String(cfg.siteUrl || 'https://www.roomzo.in').replace(/\/$/, '');
  const queueLink = `${site}/admin/listings`;
  const name = opts.propertyName ? escapeHtml(opts.propertyName) : `Listing #${opts.listingId}`;
  const place = [opts.city, opts.state].filter(Boolean).map(escapeHtml).join(', ');
  const rent = Number(opts.rentAmount);
  const rentLine = Number.isFinite(rent) && rent > 0 ? `₹${rent.toLocaleString('en-IN')}` : '—';
  const owner = [opts.ownerName, opts.ownerEmail, opts.ownerPhone].filter(Boolean).map(escapeHtml).join(' · ');
  const dup = opts.duplicateFlag
    ? `<p style="color:#9a3412">Possible duplicate: ${escapeHtml(opts.duplicateFlag)}</p>`
    : '';

  await sendMailSafe({
    to,
    subject: `Approve listing #${opts.listingId} — ${opts.propertyName || 'new property'}`,
    text: `A property is waiting for approval.\n\n#${opts.listingId} ${opts.propertyName || ''}\n${place}\nRent ${rentLine}\nOwner ${owner || '—'}\n\nOpen queue: ${queueLink}`,
    html: wrap(
      `<p>Someone listed a property. Please review and approve it.</p>
       <p><strong>#${opts.listingId} ${name}</strong><br/>${place || 'Location not set'}<br/>Rent ${rentLine}</p>
       <p>Owner: ${owner || '—'}</p>
       ${dup}
       <p><a href="${queueLink}">Open listing queue and approve</a></p>`
    ),
  });
}

export function duplicateSubmitMessage(): string {
  return DUP_MESSAGE;
}

export async function emailListingDuplicate(to: string | null | undefined, propertyName?: string): Promise<void> {
  const name = propertyName ? ` (${propertyName})` : '';
  await sendUserMailAndCopyAdmin({
    to,
    subject: 'This property already looks listed on Roomzo',
    text: `We could not publish your listing${name} because it matches one we already have. No contact points are added until a unique listing is approved.`,
    html: wrap(
      `<p>We could not publish your listing<strong>${name}</strong> because it matches one we already have on Roomzo.</p>
       <p>No contact points are added until a unique listing is approved. If this is a different property, reply to this email with the address and photos.</p>`
    ),
  });
}

export async function emailListingApproved(
  to: string | null | undefined,
  opts: { propertyName?: string; listingId: number; credited: boolean; credits?: number }
): Promise<void> {
  const { credits, rupees } = getListingRewardConfig();
  const granted = Number(opts.credits) > 0 ? Number(opts.credits) : credits;
  const site = getServerRuntime().siteUrl.replace(/\/$/, '');
  const link = `${site}/room/${opts.listingId}`;
  const name = opts.propertyName ? ` <strong>${escapeHtml(opts.propertyName)}</strong>` : '';
  const rewardLine = opts.credited
    ? `We added <strong>${granted} contact points</strong> (about ₹${rupees}) to your wallet.`
    : 'Your listing is live. Reward points for this listing were already in your wallet.';
  await sendUserMailAndCopyAdmin({
    to,
    subject: opts.credited
      ? `You received ${granted} contact points — listing is live`
      : 'Your Roomzo listing is live',
    text: `Your listing is approved and live. ${
      opts.credited ? `${granted} contact points (about ₹${rupees}) were added to your wallet.` : ''
    } View it: ${link}`,
    html: wrap(
      `<p>Your listing${name} is approved and now live on Roomzo.</p>
       <p>${rewardLine}</p>
       <p><a href="${link}">View listing</a></p>`
    ),
  });
}

export async function emailListingRejected(
  to: string | null | undefined,
  opts: { propertyName?: string; reason: 'duplicate' | 'not_legit' | string }
): Promise<void> {
  const isDup = opts.reason === 'duplicate';
  await sendUserMailAndCopyAdmin({
    to,
    subject: isDup ? 'This property already looks listed on Roomzo' : 'Your Roomzo listing was not published',
    text: isDup
      ? 'We could not publish this listing because it matches one we already have. No contact points were added.'
      : 'We could not publish this listing after review. It is not live and no contact points were added.',
    html: wrap(
      isDup
        ? `<p>We could not publish your listing${opts.propertyName ? ` <strong>${escapeHtml(opts.propertyName)}</strong>` : ''} because it matches one we already have.</p>
           <p>It is not live and no contact points were added.</p>`
        : `<p>We reviewed your listing${opts.propertyName ? ` <strong>${escapeHtml(opts.propertyName)}</strong>` : ''} and could not publish it.</p>
           <p>It is not live and no contact points were added. You can post a genuine, unique property anytime.</p>`
    ),
  });
}

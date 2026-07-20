// Green API integration — talks to Green API directly from the browser (CORS
// is enabled on their endpoints, so no server is needed), same pattern as
// telegram.js. A Green API "instance" links the owner's WhatsApp number via a
// QR scan in the Green API console; the instance id + API token authenticate
// every call.

const DEFAULT_API_URL = 'https://api.green-api.com';

// { apiUrl?, instanceId, token }
const base = (cfg) =>
  `${(cfg.apiUrl || DEFAULT_API_URL).trim().replace(/\/+$/, '')}/waInstance${String(cfg.instanceId).trim()}`;

async function asJson(res) {
  const j = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((j && (j.message || j.error)) || `Green API error (${res.status})`);
  }
  return j;
}

// Instance state: 'authorized' means the WhatsApp number is linked and ready.
export async function waGetState(cfg) {
  const res = await fetch(`${base(cfg)}/getStateInstance/${cfg.token.trim()}`);
  return asJson(res); // { stateInstance: 'authorized' | 'notAuthorized' | ... }
}

// Long-poll one incoming notification. Returns { receiptId, body } or null.
export async function waReceiveNotification(cfg, timeoutSec = 20) {
  const res = await fetch(
    `${base(cfg)}/receiveNotification/${cfg.token.trim()}?receiveTimeout=${timeoutSec}`,
  );
  return asJson(res);
}

// Every received notification must be deleted, or it is redelivered forever.
export async function waDeleteNotification(cfg, receiptId) {
  const res = await fetch(`${base(cfg)}/deleteNotification/${cfg.token.trim()}/${receiptId}`, {
    method: 'DELETE',
  });
  return asJson(res);
}

export async function waSendMessage(cfg, chatId, message) {
  const res = await fetch(`${base(cfg)}/sendMessage/${cfg.token.trim()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, message }),
  });
  return asJson(res);
}

// Send a PDF (or any file) as an attachment.
export async function waSendFile(cfg, chatId, { bytes, fileName, caption, mime = 'application/pdf' }) {
  const form = new FormData();
  form.append('chatId', chatId);
  if (caption) form.append('caption', caption);
  form.append('fileName', fileName || 'document.pdf');
  form.append('file', new Blob([bytes], { type: mime }), fileName || 'document.pdf');
  const res = await fetch(`${base(cfg)}/sendFileByUpload/${cfg.token.trim()}`, {
    method: 'POST',
    body: form,
  });
  return asJson(res);
}

// Extract the text of an incoming message notification, or null when the
// notification is not a plain incoming text message (status updates, media...).
export function waIncomingText(body) {
  if (body?.typeWebhook !== 'incomingMessageReceived') return null;
  const md = body.messageData || {};
  const text = md.textMessageData?.textMessage || md.extendedTextMessageData?.text || null;
  if (!text) return null;
  return {
    chatId: body.senderData?.chatId || null,
    senderName: body.senderData?.senderName || '',
    text,
  };
}

// '972501234567@c.us' -> '972501234567'; group chats end with '@g.us'.
export const waIsGroup = (chatId) => typeof chatId === 'string' && chatId.endsWith('@g.us');
export const waNumber = (chatId) => String(chatId || '').replace(/@.*$/, '');

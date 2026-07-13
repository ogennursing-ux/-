// Owner settings (stored on the owner's device) + best-effort notifications:
// email through a Make.com webhook (Webhook -> Gmail) and/or a Telegram bot.
import { notifyTelegram } from './telegram.js';

const SETTINGS_KEY = 'owner_settings';

export function getSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  } catch {
    return {};
  }
}

export function saveSettings(s) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

// POST a JSON payload to the configured Make webhook. Best-effort: never throws,
// so a missing/broken webhook can't block the signing flow.
export async function notify(webhook, payload) {
  if (!webhook) return false;
  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      // Make webhooks are cross-origin; we don't need to read the response.
      mode: 'no-cors',
    });
    return true;
  } catch (e) {
    console.warn('notify failed', e);
    return false;
  }
}

// The requests table has a single `webhook_url` text column, so when Telegram
// is configured we pack both targets into it as JSON. A plain URL string keeps
// working as before (backward compatible with existing rows).
export function packNotifyTarget(settings = {}) {
  const webhook = (settings.webhook || '').trim() || null;
  const token = (settings.tgToken || '').trim();
  const chatId = String(settings.tgChatId || '').trim();
  if (!token || !chatId) return webhook;
  return JSON.stringify({ v: 1, webhook, telegram: { token, chatId } });
}

export function unpackNotifyTarget(raw) {
  const s = (raw || '').trim();
  if (!s) return { webhook: null, telegram: null };
  if (s.startsWith('{')) {
    try {
      const j = JSON.parse(s);
      return { webhook: j.webhook || null, telegram: j.telegram || null };
    } catch {
      return { webhook: null, telegram: null };
    }
  }
  return { webhook: s, telegram: null };
}

// Dispatch one signing event to every configured channel. The Make webhook
// needs a recipient email (payload.to); Telegram only needs the bot config.
// pdfBytes (optional) is attached to Telegram 'completed' messages.
export async function notifyAll(rawTarget, payload, pdfBytes) {
  const { webhook, telegram } = unpackNotifyTarget(rawTarget);
  await Promise.all([
    webhook && payload.to ? notify(webhook, payload) : null,
    telegram ? notifyTelegram(telegram, payload, pdfBytes) : null,
  ]);
}

// Best-effort lookup of the signer's public IP (for the audit trail).
export async function getIp() {
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const j = await res.json();
    return j.ip || null;
  } catch {
    return null;
  }
}

// Convert PDF bytes to base64 (for emailing the signed file as an attachment).
export function bytesToBase64(bytes) {
  let bin = '';
  const arr = new Uint8Array(bytes);
  const chunk = 0x8000;
  for (let i = 0; i < arr.length; i += chunk) {
    bin += String.fromCharCode.apply(null, arr.subarray(i, i + chunk));
  }
  return btoa(bin);
}

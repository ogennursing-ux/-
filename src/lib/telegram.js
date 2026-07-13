// Telegram Bot API integration — talks directly to api.telegram.org from the
// browser (the Bot API sends CORS headers, so no server is needed).
//
// The bot token + chat id are embedded in signing requests so the *signer's*
// browser can notify the owner, same as the Make webhook. Use a dedicated
// notification bot — anyone with a signing link could read its token.

const api = (token, method) => `https://api.telegram.org/bot${token.trim()}/${method}`;

async function call(token, method, body) {
  const res = await fetch(api(token, method), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  if (!j.ok) throw new Error(j.description || `Telegram API error (${res.status})`);
  return j.result;
}

export function tgSendMessage(token, chatId, text) {
  return call(token, 'sendMessage', {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  });
}

// Send a PDF as a document attachment (multipart, since bytes can't go in JSON).
export async function tgSendDocument(token, chatId, { bytes, fileName, caption }) {
  const form = new FormData();
  form.append('chat_id', chatId);
  if (caption) form.append('caption', caption);
  form.append('document', new Blob([bytes], { type: 'application/pdf' }), fileName || 'document.pdf');
  const res = await fetch(api(token, 'sendDocument'), { method: 'POST', body: form });
  const j = await res.json().catch(() => ({}));
  if (!j.ok) throw new Error(j.description || `Telegram API error (${res.status})`);
  return j.result;
}

// Verify the token and return the bot's username (throws on a bad token).
export async function tgGetMe(token) {
  return call(token, 'getMe', {});
}

// Find the chat id automatically: the user sends any message to the bot,
// then we read it from getUpdates. Returns { id, name } or null.
export async function tgDetectChatId(token) {
  const updates = await call(token, 'getUpdates', { limit: 100 });
  for (let i = updates.length - 1; i >= 0; i--) {
    const msg = updates[i].message || updates[i].edited_message || updates[i].channel_post;
    if (msg?.chat?.id) {
      const c = msg.chat;
      const name = c.title || [c.first_name, c.last_name].filter(Boolean).join(' ') || c.username || '';
      return { id: String(c.id), name };
    }
  }
  return null;
}

// ---- best-effort notification (never throws, like notify()) ----

function fmt(payload) {
  const { type, title, to, link } = payload;
  const doc = `«${title || 'מסמך'}»`;
  if (type === 'completed') {
    return `✅ המסמך ${doc} נחתם על ידי כל החותמים!${link ? `\n${link}` : ''}`;
  }
  if (type === 'invite') {
    return `✉️ ${doc} — קישור חתימה נשלח אל ${to || 'החותם'}${link ? `\n${link}` : ''}`;
  }
  return `🔔 ${doc} — עדכון (${type})${link ? `\n${link}` : ''}`;
}

// Send a Telegram notification for a signing event; attaches the signed PDF
// when available. Best-effort: a broken bot must never block the signing flow.
export async function notifyTelegram(tg, payload, pdfBytes) {
  if (!tg?.token || !tg?.chatId) return false;
  try {
    if (payload.type === 'completed' && pdfBytes) {
      await tgSendDocument(tg.token, tg.chatId, {
        bytes: pdfBytes,
        fileName: payload.fileName || 'signed.pdf',
        caption: fmt(payload),
      });
    } else {
      await tgSendMessage(tg.token, tg.chatId, fmt(payload));
    }
    return true;
  } catch (e) {
    console.warn('telegram notify failed', e);
    return false;
  }
}

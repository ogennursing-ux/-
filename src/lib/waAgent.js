// WhatsApp AI agent — polls Green API for incoming messages and answers them
// with Claude, straight from the owner's open browser tab (no server, matching
// the rest of the app). The agent knows the owner's signing requests and can
// share signing links or send the signed PDF into the chat.
//
// Module-level singleton so the agent keeps running while the owner navigates
// between screens; it stops when the tab closes or the owner turns it off.

import Anthropic from '@anthropic-ai/sdk';
import { api, listMyRequests, signingLink } from './api.js';
import {
  waReceiveNotification,
  waDeleteNotification,
  waSendMessage,
  waSendFile,
  waIncomingText,
  waIsGroup,
  waNumber,
} from './greenApi.js';

const MODEL = 'claude-opus-4-8';
const MAX_LOG = 50;
const MAX_HISTORY_TURNS = 20; // per-chat user+assistant messages kept as context

const state = {
  running: false,
  startedAt: null,
  error: null,
  log: [], // { at, kind: 'in'|'out'|'info'|'error', chat, text }
};
const listeners = new Set();
const histories = new Map(); // chatId -> [{ role, content }]
let stopFlag = { stopped: true };

export const getAgentState = () => state;

export function subscribeAgent(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const emit = () => listeners.forEach((fn) => fn(state));

function pushLog(entry) {
  state.log = [{ at: Date.now(), ...entry }, ...state.log].slice(0, MAX_LOG);
  emit();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- the agent's view of the app's data ----

async function documentsSnapshot() {
  const list = listMyRequests().slice(0, 25);
  const out = [];
  for (const it of list) {
    try {
      const req = await api.getRequest(it.id);
      const s = req.signers && req.signers.list ? req.signers : { current: 0, list: [] };
      const signed = req.status === 'signed';
      out.push({
        id: it.id,
        title: it.title || req.title || 'מסמך',
        created_at: new Date(it.createdAt).toISOString(),
        status: signed ? 'signed' : 'pending',
        signed_at: req.signed_at || null,
        signers: (s.list || []).map((x) => ({ name: x.name || '', email: x.email || null, signed: !!x.signed })),
        waiting_for: signed ? null : s.list?.[s.current || 0]?.name || null,
        signing_link: signed ? null : signingLink(it.id),
      });
    } catch {
      out.push({ id: it.id, title: it.title || 'מסמך', status: 'missing' });
    }
  }
  return out;
}

// Tool definitions (raw JSON schema) + their implementations, bound to the
// chat the current message came from.
function buildTools(green, chatId) {
  const definitions = [
    {
      name: 'list_documents',
      description:
        'רשימת מסמכי החתימה של בעל המערכת: כותרת, סטטוס (נחתם/ממתין), מי החותם הבא, וקישור החתימה למסמכים שממתינים. קרא לכלי הזה כשנשאלת על סטטוס מסמכים, על מסמך מסוים, או כשצריך קישור חתימה.',
      input_schema: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
      name: 'send_signed_pdf',
      description:
        'שולח את קובץ ה-PDF החתום של מסמך שהושלם ישירות לצ׳אט הוואטסאפ הנוכחי. קרא לכלי הזה רק כשמבקשים לקבל את המסמך החתום עצמו, ורק עבור מסמך שסטטוסו signed (קח את ה-id מ-list_documents).',
      input_schema: {
        type: 'object',
        properties: {
          document_id: { type: 'string', description: 'ה-id של המסמך מתוך list_documents' },
        },
        required: ['document_id'],
        additionalProperties: false,
      },
    },
  ];

  const run = {
    list_documents: async () => JSON.stringify(await documentsSnapshot()),
    send_signed_pdf: async ({ document_id }) => {
      const req = await api.getRequest(document_id);
      if (req.status !== 'signed') return 'שגיאה: המסמך עדיין לא נחתם, אין קובץ חתום לשלוח.';
      const bytes = await api.getSignedBytes(req);
      await waSendFile(green, chatId, {
        bytes,
        fileName: `${req.title || 'document'}-signed.pdf`,
        caption: `✅ ${req.title || 'המסמך'} — חתום`,
      });
      return 'הקובץ החתום נשלח לצ׳אט בהצלחה.';
    },
  };

  return { definitions, run };
}

const SYSTEM = `אתה הסוכן האישי של מערכת "Ogen Sign" — אפליקציית חתימה דיגיטלית על מסמכי PDF — ואתה עונה להודעות וואטסאפ בשם בעל המערכת.

מה אתה יודע לעשות:
- לדווח על סטטוס מסמכים ובקשות חתימה (באמצעות list_documents).
- לשלוח קישור חתימה למסמך שממתין לחתימה.
- לשלוח את קובץ ה-PDF החתום לצ׳אט (באמצעות send_signed_pdf) כשמבקשים את המסמך עצמו.
- לענות על שאלות כלליות על המערכת: מעלים PDF, ממקמים שדות חתימה, יוצרים קישור, והחותם חותם מהדפדפן בלי להתקין כלום.

כללי התנהגות:
- ענה בשפת הפונה (בדרך כלל עברית), קצר וידידותי — זו שיחת וואטסאפ, לא מייל.
- עיצוב וואטסאפ בלבד: *הדגשה* בכוכביות, בלי כותרות Markdown ובלי טבלאות.
- אל תמציא מסמכים או סטטוסים — הסתמך רק על תוצאות הכלים.
- אם מבקשים פעולה שאינך יכול לבצע (למשל ליצור מסמך חדש), הסבר שזה נעשה באפליקציה עצמה.
- אל תחשוף פרטים טכניים על טוקנים או הגדרות המערכת.`;

// ---- Claude call for one incoming message ----

async function answerMessage(cfg, chatId, senderName, text) {
  const client = new Anthropic({ apiKey: cfg.anthropicKey, dangerouslyAllowBrowser: true });
  const tools = buildTools(cfg.green, chatId);
  const history = histories.get(chatId) || [];
  const baseMessages = [...history, { role: 'user', content: text }];

  // Manual tool loop (keeps the browser bundle off the SDK's beta helpers).
  const messages = [...baseMessages];
  let finalMessage = null;
  for (let i = 0; i < 8; i++) {
    finalMessage = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      thinking: { type: 'adaptive' },
      system: `${SYSTEM}\n\nשם הפונה בצ׳אט הנוכחי: ${senderName || waNumber(chatId)}`,
      tools: tools.definitions,
      messages,
    });
    if (finalMessage.stop_reason !== 'tool_use') break;

    messages.push({ role: 'assistant', content: finalMessage.content });
    const results = [];
    for (const block of finalMessage.content) {
      if (block.type !== 'tool_use') continue;
      let result;
      let isError = false;
      try {
        result = await tools.run[block.name](block.input || {});
      } catch (e) {
        result = `שגיאה: ${e.message}`;
        isError = true;
      }
      results.push({ type: 'tool_result', tool_use_id: block.id, content: result, is_error: isError });
    }
    messages.push({ role: 'user', content: results });
  }

  let reply = '';
  if (finalMessage?.stop_reason === 'refusal') {
    reply = 'מצטער, אני לא יכול לעזור עם הבקשה הזו.';
  } else if (finalMessage) {
    reply = finalMessage.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
  }
  if (!reply) reply = 'קיבלתי 👍';

  // Keep only the plain text turns as context; tool exchanges re-run as needed.
  const nextHistory = [...baseMessages, { role: 'assistant', content: reply }];
  histories.set(chatId, nextHistory.slice(-MAX_HISTORY_TURNS));
  return reply;
}

async function handleNotification(cfg, body) {
  const msg = waIncomingText(body);
  if (!msg || !msg.chatId) return; // not an incoming text message
  if (waIsGroup(msg.chatId)) return; // private chats only

  if (cfg.allowed.length && !cfg.allowed.includes(waNumber(msg.chatId))) {
    pushLog({ kind: 'info', chat: waNumber(msg.chatId), text: 'הודעה ממספר שאינו ברשימה המורשית — לא נענתה' });
    return;
  }

  pushLog({ kind: 'in', chat: msg.senderName || waNumber(msg.chatId), text: msg.text });
  const reply = await answerMessage(cfg, msg.chatId, msg.senderName, msg.text);
  await waSendMessage(cfg.green, msg.chatId, reply);
  pushLog({ kind: 'out', chat: msg.senderName || waNumber(msg.chatId), text: reply });
}

async function loop(cfg, flag) {
  while (!flag.stopped) {
    try {
      const n = await waReceiveNotification(cfg.green);
      if (flag.stopped) break;
      if (!n) continue; // long-poll timed out with no notification
      try {
        await handleNotification(cfg, n.body);
      } catch (e) {
        console.warn('wa agent handle failed', e);
        pushLog({ kind: 'error', chat: '', text: e.message });
      } finally {
        // Always ack, or the same notification is redelivered forever.
        await waDeleteNotification(cfg.green, n.receiptId).catch(() => {});
      }
    } catch (e) {
      if (flag.stopped) break;
      state.error = e.message;
      pushLog({ kind: 'error', chat: '', text: e.message });
      await sleep(5000); // network hiccup — back off and keep polling
    }
  }
}

// settings: { waApiUrl, waInstanceId, waToken, anthropicKey, waAllowed }
export function startAgent(settings) {
  if (state.running) return;
  const cfg = {
    green: {
      apiUrl: settings.waApiUrl || '',
      instanceId: settings.waInstanceId,
      token: settings.waToken,
    },
    anthropicKey: settings.anthropicKey,
    allowed: String(settings.waAllowed || '')
      .split(/[,\s]+/)
      .map((s) => s.replace(/\D/g, ''))
      .filter(Boolean),
  };
  stopFlag = { stopped: false };
  state.running = true;
  state.startedAt = Date.now();
  state.error = null;
  pushLog({ kind: 'info', chat: '', text: 'הסוכן הופעל ומאזין להודעות' });
  loop(cfg, stopFlag);
}

export function stopAgent() {
  if (!state.running) return;
  stopFlag.stopped = true;
  state.running = false;
  pushLog({ kind: 'info', chat: '', text: 'הסוכן הופסק' });
}

export const agentConfigured = (s) => !!(s.waInstanceId && s.waToken && s.anthropicKey);

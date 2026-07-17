// Chat layer for Kimi (Moonshot AI) — OpenAI-compatible chat/completions with
// SSE streaming and a tool-calling loop. Runs entirely in the browser.

import { GITHUB_TOOLS, executeGithubTool } from './githubTools.js';

export const PROVIDERS = [
  {
    id: 'moonshot',
    label: 'Moonshot — בינלאומי (api.moonshot.ai)',
    baseUrl: 'https://api.moonshot.ai/v1',
    defaultModel: 'kimi-k2-0905-preview',
    keyUrl: 'https://platform.moonshot.ai/console/api-keys',
  },
  {
    id: 'moonshot-cn',
    label: 'Moonshot — סין (api.moonshot.cn)',
    baseUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'kimi-k2-0905-preview',
    keyUrl: 'https://platform.moonshot.cn/console/api-keys',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter (מריץ את Kimi K2, עובד תמיד מהדפדפן)',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'moonshotai/kimi-k2-0905',
    keyUrl: 'https://openrouter.ai/keys',
  },
  {
    id: 'custom',
    label: 'מותאם אישית (כל API תואם OpenAI)',
    baseUrl: '',
    defaultModel: '',
    keyUrl: '',
  },
];

export const MODEL_SUGGESTIONS = [
  'kimi-k2-0905-preview',
  'kimi-k2-turbo-preview',
  'kimi-k2-thinking',
  'kimi-latest',
  'moonshotai/kimi-k2-0905',
  'moonshotai/kimi-k2-thinking',
];

const DEFAULT_SYSTEM_PROMPT = [
  'את/ה Kimi, עוזר/ת AI מועיל/ה. ענה/י בשפה שבה המשתמש פונה אליך (בדרך כלל עברית).',
  'כשיש לך כלים של GitHub — השתמש/י בהם כדי לענות על סמך מידע אמיתי מהמאגרים,',
  'ואל תפתח/י Issues או תבצע/י פעולות כתיבה בלי בקשה מפורשת של המשתמש.',
].join(' ');

const MAX_TOOL_ROUNDS = 8;

function friendlyError(err, baseUrl) {
  if (err.name === 'AbortError') return err;
  if (err instanceof TypeError) {
    // fetch network failure — most likely CORS when the endpoint blocks browsers
    return new Error(
      `לא הצלחתי להתחבר אל ${baseUrl}. ייתכן שהשרת חוסם קריאות מדפדפן (CORS) ` +
        'או שאין חיבור לאינטרנט. טיפ: ספק OpenRouter תומך תמיד בקריאות מהדפדפן.'
    );
  }
  return err;
}

// One streamed chat/completions request. Calls onDelta with the full text so
// far on every chunk; returns { content, toolCalls, finishReason }.
async function streamChat({ settings, messages, tools, onDelta, signal }) {
  const baseUrl = settings.baseUrl.replace(/\/+$/, '');
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${settings.apiKey}`,
  };
  if (baseUrl.includes('openrouter.ai')) {
    headers['X-Title'] = 'Ogen Kimi Chat';
  }

  let res;
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      signal,
      body: JSON.stringify({
        model: settings.model,
        messages,
        temperature: 0.6,
        stream: true,
        ...(tools?.length ? { tools } : {}),
      }),
    });
  } catch (err) {
    throw friendlyError(err, baseUrl);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (res.status === 401) throw new Error('המפתח נדחה (401) — בדקו את מפתח ה-API בהגדרות.');
    if (res.status === 429) throw new Error('חריגה ממכסה (429) — בדקו יתרה/קצב בחשבון הספק.');
    throw new Error(`שגיאת API ${res.status}: ${text.slice(0, 300)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let content = '';
  let finishReason = null;
  const toolCalls = [];

  const handleLine = (line) => {
    if (!line.startsWith('data:')) return;
    const data = line.slice(5).trim();
    if (!data || data === '[DONE]') return;
    let json;
    try {
      json = JSON.parse(data);
    } catch {
      return;
    }
    const choice = json.choices?.[0];
    if (!choice) return;
    const delta = choice.delta || {};
    if (delta.content) {
      content += delta.content;
      onDelta?.(content);
    }
    for (const t of delta.tool_calls || []) {
      const i = t.index ?? 0;
      if (!toolCalls[i]) {
        toolCalls[i] = { id: '', type: 'function', function: { name: '', arguments: '' } };
      }
      if (t.id) toolCalls[i].id = t.id;
      if (t.function?.name) toolCalls[i].function.name += t.function.name;
      if (t.function?.arguments) toolCalls[i].function.arguments += t.function.arguments;
    }
    if (choice.finish_reason) finishReason = choice.finish_reason;
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    lines.forEach(handleLine);
  }
  if (buffer) handleLine(buffer);

  return { content, toolCalls: toolCalls.filter(Boolean), finishReason };
}

function safeParseArgs(raw) {
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

// Runs a full assistant turn, including tool-calling rounds against GitHub.
// onUpdate receives the growing message list after every append, so the UI
// can persist and render incrementally. Returns the final message list.
export async function runConversation({ settings, messages, onUpdate, onDelta, onTool, signal }) {
  const convo = [...messages];
  const useTools = !!settings.githubToken;
  const system = {
    role: 'system',
    content: settings.systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT,
  };

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const res = await streamChat({
      settings,
      messages: [system, ...convo],
      tools: useTools ? GITHUB_TOOLS : undefined,
      onDelta,
      signal,
    });

    const assistantMsg = { role: 'assistant', content: res.content };
    if (res.toolCalls.length) assistantMsg.tool_calls = res.toolCalls;
    convo.push(assistantMsg);
    onUpdate?.([...convo]);
    onDelta?.('');

    if (!res.toolCalls.length) return convo;

    for (const tc of res.toolCalls) {
      if (signal?.aborted) return convo;
      onTool?.(tc.function.name);
      const result = await executeGithubTool(
        tc.function.name,
        safeParseArgs(tc.function.arguments),
        settings.githubToken
      );
      convo.push({ role: 'tool', tool_call_id: tc.id, name: tc.function.name, content: result });
    }
    onUpdate?.([...convo]);
    onTool?.(null);
  }

  convo.push({
    role: 'assistant',
    content: 'עצרתי — בוצעו יותר מדי סבבי כלים ברצף. נסחו את הבקשה מחדש או פצלו אותה.',
  });
  onUpdate?.([...convo]);
  return convo;
}

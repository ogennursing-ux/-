// GitHub tools that Kimi can call (OpenAI-compatible tool calling).
// All requests run in the browser against api.github.com with the user's
// personal access token; nothing goes through a server.

const GH = 'https://api.github.com';
const MAX_RESULT_CHARS = 6000;

export const GITHUB_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'github_list_my_repos',
      description: 'רשימת המאגרים (repos) של המשתמש המחובר, ממוינים לפי פעילות אחרונה',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'github_list_files',
      description: 'רשימת קבצים ותיקיות בנתיב מסוים במאגר',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'בעל המאגר' },
          repo: { type: 'string', description: 'שם המאגר' },
          path: { type: 'string', description: 'נתיב תיקייה (ריק = שורש)' },
          ref: { type: 'string', description: 'ענף או commit (ברירת מחדל: ענף ראשי)' },
        },
        required: ['owner', 'repo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'github_get_file',
      description: 'קריאת תוכן של קובץ במאגר',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string' },
          repo: { type: 'string' },
          path: { type: 'string', description: 'נתיב הקובץ' },
          ref: { type: 'string', description: 'ענף או commit (אופציונלי)' },
        },
        required: ['owner', 'repo', 'path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'github_search_code',
      description: 'חיפוש קוד ב-GitHub. אפשר לצמצם עם qualifiers כמו repo:owner/name או language:js',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'שאילתת חיפוש' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'github_list_issues',
      description: 'רשימת Issues במאגר',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string' },
          repo: { type: 'string' },
          state: { type: 'string', enum: ['open', 'closed', 'all'], description: 'ברירת מחדל: open' },
        },
        required: ['owner', 'repo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'github_create_issue',
      description: 'פתיחת Issue חדש במאגר. להשתמש רק כשהמשתמש ביקש זאת במפורש',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string' },
          repo: { type: 'string' },
          title: { type: 'string', description: 'כותרת ה-Issue' },
          body: { type: 'string', description: 'תוכן ה-Issue' },
        },
        required: ['owner', 'repo', 'title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'github_list_commits',
      description: 'רשימת ה-commits האחרונים במאגר',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string' },
          repo: { type: 'string' },
          ref: { type: 'string', description: 'ענף (אופציונלי)' },
        },
        required: ['owner', 'repo'],
      },
    },
  },
];

async function ghFetch(token, path, options = {}) {
  const res = await fetch(`${GH}${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status}: ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : null;
}

function decodeBase64Utf8(b64) {
  const bin = atob(b64.replace(/\n/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}

function clip(value) {
  const s = typeof value === 'string' ? value : JSON.stringify(value, null, 1);
  return s.length > MAX_RESULT_CHARS ? `${s.slice(0, MAX_RESULT_CHARS)}\n…(קוצר)` : s;
}

export async function executeGithubTool(name, args, token) {
  if (!token) return 'שגיאה: לא הוגדר טוקן GitHub בהגדרות.';
  try {
    switch (name) {
      case 'github_list_my_repos': {
        const repos = await ghFetch(token, '/user/repos?sort=pushed&per_page=30');
        return clip(repos.map((r) => ({
          full_name: r.full_name,
          private: r.private,
          description: r.description,
          default_branch: r.default_branch,
          pushed_at: r.pushed_at,
        })));
      }
      case 'github_list_files': {
        const q = args.ref ? `?ref=${encodeURIComponent(args.ref)}` : '';
        const path = args.path ? encodeURIComponent(args.path).replace(/%2F/g, '/') : '';
        const items = await ghFetch(token, `/repos/${args.owner}/${args.repo}/contents/${path}${q}`);
        const list = Array.isArray(items) ? items : [items];
        return clip(list.map((i) => `${i.type === 'dir' ? '📁' : '📄'} ${i.path}`).join('\n'));
      }
      case 'github_get_file': {
        const q = args.ref ? `?ref=${encodeURIComponent(args.ref)}` : '';
        const path = encodeURIComponent(args.path).replace(/%2F/g, '/');
        const file = await ghFetch(token, `/repos/${args.owner}/${args.repo}/contents/${path}${q}`);
        if (file.encoding !== 'base64' || file.content == null) {
          return `הקובץ גדול מדי או בינארי (${file.size} bytes). נסו קובץ אחר.`;
        }
        return clip(decodeBase64Utf8(file.content));
      }
      case 'github_search_code': {
        const data = await ghFetch(token, `/search/code?per_page=15&q=${encodeURIComponent(args.query)}`);
        return clip(data.items.map((i) => `${i.repository.full_name}: ${i.path}`).join('\n') || 'לא נמצאו תוצאות');
      }
      case 'github_list_issues': {
        const state = args.state || 'open';
        const issues = await ghFetch(
          token,
          `/repos/${args.owner}/${args.repo}/issues?per_page=20&state=${encodeURIComponent(state)}`
        );
        return clip(issues.map((i) => ({
          number: i.number,
          title: i.title,
          state: i.state,
          is_pull_request: !!i.pull_request,
        })));
      }
      case 'github_create_issue': {
        const issue = await ghFetch(token, `/repos/${args.owner}/${args.repo}/issues`, {
          method: 'POST',
          body: JSON.stringify({ title: args.title, body: args.body || '' }),
        });
        return `נוצר Issue #${issue.number}: ${issue.html_url}`;
      }
      case 'github_list_commits': {
        const q = args.ref ? `&sha=${encodeURIComponent(args.ref)}` : '';
        const commits = await ghFetch(token, `/repos/${args.owner}/${args.repo}/commits?per_page=15${q}`);
        return clip(commits.map((c) => `${c.sha.slice(0, 7)} ${c.commit.message.split('\n')[0]}`).join('\n'));
      }
      default:
        return `שגיאה: כלי לא מוכר בשם ${name}`;
    }
  } catch (err) {
    return `שגיאה בהרצת הכלי: ${err.message}`;
  }
}

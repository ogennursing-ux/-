import React, { useEffect, useMemo, useRef, useState } from 'react';
import Markdown from './Markdown.jsx';
import SettingsModal from './SettingsModal.jsx';
import { runConversation } from './api.js';
import {
  loadSettings, saveSettings,
  loadTabs, saveTabs, newTab,
  loadActiveTabId, saveActiveTabId,
} from './storage.js';

const TOOL_LABELS = {
  github_list_my_repos: 'קורא את רשימת המאגרים',
  github_list_files: 'קורא רשימת קבצים',
  github_get_file: 'קורא קובץ',
  github_search_code: 'מחפש קוד',
  github_list_issues: 'קורא Issues',
  github_create_issue: 'פותח Issue',
  github_list_commits: 'קורא commits',
};

export default function App() {
  const [settings, setSettings] = useState(loadSettings);
  const [tabs, setTabs] = useState(loadTabs);
  const [activeId, setActiveId] = useState(() => loadActiveTabId());
  const [showSettings, setShowSettings] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const [toolNote, setToolNote] = useState(null);
  const [error, setError] = useState(null);

  const abortRef = useRef(null);
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeId) || tabs[0],
    [tabs, activeId]
  );

  useEffect(() => saveTabs(tabs), [tabs]);
  useEffect(() => { if (activeTab) saveActiveTabId(activeTab.id); }, [activeTab]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [activeTab?.messages, draft, toolNote]);

  const updateTab = (id, patch) =>
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const addTab = () => {
    const t = newTab();
    setTabs((prev) => [...prev, t]);
    setActiveId(t.id);
    setError(null);
  };

  const closeTab = (id) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id);
      const result = next.length ? next : [newTab()];
      if (id === activeTab?.id) setActiveId(result[result.length - 1].id);
      return result;
    });
  };

  const renameTab = (tab) => {
    const title = prompt('שם למשימה:', tab.title);
    if (title?.trim()) updateTab(tab.id, { title: title.trim() });
  };

  const stop = () => abortRef.current?.abort();

  const send = async () => {
    const text = input.trim();
    if (!text || sending || !activeTab) return;
    if (!settings.apiKey) {
      setShowSettings(true);
      return;
    }

    const tabId = activeTab.id;
    const userMsg = { role: 'user', content: text };
    const startMessages = [...activeTab.messages, userMsg];
    const patch = { messages: startMessages };
    if (activeTab.title === 'משימה חדשה') {
      patch.title = text.length > 28 ? `${text.slice(0, 28)}…` : text;
    }
    updateTab(tabId, patch);
    setInput('');
    setError(null);
    setSending(true);
    setDraft('');
    abortRef.current = new AbortController();

    try {
      await runConversation({
        settings,
        messages: startMessages,
        signal: abortRef.current.signal,
        onDelta: setDraft,
        onTool: setToolNote,
        onUpdate: (msgs) => updateTab(tabId, { messages: msgs }),
      });
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message);
    } finally {
      setSending(false);
      setDraft('');
      setToolNote(null);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const visibleMessages = (activeTab?.messages || []).filter(
    (m) => (m.role === 'user' || m.role === 'assistant') && (m.content || m.tool_calls)
  );

  return (
    <div className="kimi-app">
      <header className="kimi-header">
        <div className="brand">
          <span className="brand-mark">🌙</span>
          <span className="brand-name">Kimi Chat</span>
        </div>
        <div className="header-actions">
          <a className="back-link" href="./index.html">↩ Ogen Sign</a>
          <button className="icon-btn" onClick={() => setShowSettings(true)} title="הגדרות">⚙️</button>
        </div>
      </header>

      <nav className="tab-bar" aria-label="משימות">
        {tabs.map((t) => (
          <div
            key={t.id}
            className={`tab ${t.id === activeTab?.id ? 'active' : ''}`}
            onClick={() => { setActiveId(t.id); setError(null); }}
            onDoubleClick={() => renameTab(t)}
            title="לחיצה כפולה לשינוי שם"
          >
            <span className="tab-title">{t.title}</span>
            <button
              className="tab-close"
              onClick={(e) => { e.stopPropagation(); closeTab(t.id); }}
              aria-label={`סגירת ${t.title}`}
            >
              ✕
            </button>
          </div>
        ))}
        <button className="tab-add" onClick={addTab} aria-label="משימה חדשה">＋</button>
      </nav>

      <main className="chat-scroll" ref={scrollRef}>
        {!settings.apiKey && (
          <div className="empty-state">
            <div className="empty-icon">🌙</div>
            <h1>מדברים עם Kimi</h1>
            <p>
              כדי להתחיל צריך מפתח API של Kimi (Moonshot AI) — או של OpenRouter,
              שמריץ את Kimi K2 ועובד תמיד מהדפדפן.
            </p>
            <button className="btn-primary" onClick={() => setShowSettings(true)}>
              ⚙️ הזנת מפתח API
            </button>
          </div>
        )}

        {settings.apiKey && visibleMessages.length === 0 && !sending && (
          <div className="empty-state small">
            <p>טאב חדש — כתבו הודעה כדי להתחיל את המשימה. 🌙</p>
            {!settings.githubToken && (
              <p className="hint">
                טיפ: הוסיפו טוקן GitHub בהגדרות ו-Kimi תוכל לקרוא קוד מהמאגרים שלכם.
              </p>
            )}
          </div>
        )}

        {visibleMessages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            <div className="bubble" dir="auto">
              {m.role === 'assistant' ? <Markdown text={m.content} /> : m.content}
              {m.tool_calls?.length > 0 && (
                <div className="tool-chips">
                  {m.tool_calls.map((tc) => (
                    <span key={tc.id} className="tool-chip">
                      🔧 {TOOL_LABELS[tc.function.name] || tc.function.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {sending && (draft || toolNote) && (
          <div className="msg assistant">
            <div className="bubble" dir="auto">
              {draft ? <Markdown text={draft} /> : null}
              {toolNote && (
                <div className="tool-chips">
                  <span className="tool-chip pulsing">
                    🔧 {TOOL_LABELS[toolNote] || toolNote}…
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {sending && !draft && !toolNote && (
          <div className="msg assistant"><div className="bubble typing">Kimi חושבת…</div></div>
        )}

        {error && <div className="error-banner">⚠️ {error}</div>}
      </main>

      <footer className="composer">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="כתבו הודעה ל-Kimi… (Enter לשליחה, Shift+Enter לשורה חדשה)"
          rows={2}
          dir="auto"
        />
        {sending ? (
          <button className="btn-stop" onClick={stop}>⏹ עצירה</button>
        ) : (
          <button className="btn-send" onClick={send} disabled={!input.trim()}>שליחה ↑</button>
        )}
      </footer>

      {showSettings && (
        <SettingsModal
          settings={settings}
          onClose={() => setShowSettings(false)}
          onSave={(s) => {
            setSettings(s);
            saveSettings(s);
            setShowSettings(false);
            setError(null);
          }}
        />
      )}
    </div>
  );
}

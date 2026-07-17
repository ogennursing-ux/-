import React, { useState } from 'react';
import { PROVIDERS, MODEL_SUGGESTIONS } from './api.js';

export default function SettingsModal({ settings, onSave, onClose }) {
  const [form, setForm] = useState({ ...settings });

  const provider = PROVIDERS.find((p) => p.id === form.provider) || PROVIDERS[0];

  const setField = (name, value) => setForm((f) => ({ ...f, [name]: value }));

  const onProviderChange = (id) => {
    const p = PROVIDERS.find((x) => x.id === id);
    setForm((f) => ({
      ...f,
      provider: id,
      baseUrl: p.baseUrl || f.baseUrl,
      model: p.defaultModel || f.model,
    }));
  };

  const submit = (e) => {
    e.preventDefault();
    onSave({ ...form, baseUrl: form.baseUrl.trim(), apiKey: form.apiKey.trim(), model: form.model.trim() });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="modal-head">
          <h2>הגדרות Kimi</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="סגירה">✕</button>
        </div>

        <label className="field">
          <span>ספק API</span>
          <select value={form.provider} onChange={(e) => onProviderChange(e.target.value)}>
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>כתובת בסיס (Base URL)</span>
          <input
            dir="ltr"
            value={form.baseUrl}
            onChange={(e) => setField('baseUrl', e.target.value)}
            placeholder="https://api.moonshot.ai/v1"
            required
          />
        </label>

        <label className="field">
          <span>מפתח API</span>
          <input
            dir="ltr"
            type="password"
            value={form.apiKey}
            onChange={(e) => setField('apiKey', e.target.value)}
            placeholder="sk-..."
            autoComplete="off"
            required
          />
          {provider.keyUrl && (
            <small>
              אין מפתח? אפשר להנפיק אחד ב-{' '}
              <a href={provider.keyUrl} target="_blank" rel="noopener noreferrer">{provider.keyUrl}</a>
            </small>
          )}
        </label>

        <label className="field">
          <span>מודל</span>
          <input
            dir="ltr"
            list="kimi-models"
            value={form.model}
            onChange={(e) => setField('model', e.target.value)}
            required
          />
          <datalist id="kimi-models">
            {MODEL_SUGGESTIONS.map((m) => <option key={m} value={m} />)}
          </datalist>
        </label>

        <label className="field">
          <span>טוקן GitHub (אופציונלי) — נותן ל-Kimi שליטה מלאה: קריאה וכתיבה של קבצים, ענפים, Issues ו-PRs</span>
          <input
            dir="ltr"
            type="password"
            value={form.githubToken}
            onChange={(e) => setField('githubToken', e.target.value)}
            placeholder="ghp_... / github_pat_..."
            autoComplete="off"
          />
          <small>
            מנפיקים ב-{' '}
            <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer">
              github.com/settings/tokens
            </a>
            . הטוקן קובע מה מותר לה — תנו הרשאות repo מלאות לשליטה מלאה, או צמצמו למאגרים ספציפיים.
          </small>
        </label>

        <label className="field">
          <span>הנחיית מערכת (אופציונלי)</span>
          <textarea
            rows={2}
            value={form.systemPrompt}
            onChange={(e) => setField('systemPrompt', e.target.value)}
            placeholder="למשל: ענה תמיד בעברית, בקצרה ולעניין"
          />
        </label>

        <p className="privacy-note">
          🔒 המפתחות נשמרים רק ב-localStorage בדפדפן שלכם ונשלחים ישירות לספק — אין שרת באמצע.
        </p>

        <div className="modal-actions">
          <button type="submit" className="btn-primary">שמירה</button>
          <button type="button" className="btn-ghost" onClick={onClose}>ביטול</button>
        </div>
      </form>
    </div>
  );
}

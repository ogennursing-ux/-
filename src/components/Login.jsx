import { useState } from 'react';
import LangToggle from './LangToggle.jsx';
import { useT } from '../lib/i18n.js';

// Simple client-side gate for the owner area. NOTE: this is a basic gate, not
// strong security — the check runs in the browser.
const USER = 'עוגן סיעוד';
const PASS = '12345';

export default function Login({ onLogin }) {
  const t = useT();
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    if (user.trim() === USER && pass === PASS) {
      try {
        localStorage.setItem('ogen_auth', '1');
      } catch {
        /* ignore */
      }
      onLogin();
    } else {
      setError(true);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">✒️</span>
          <span className="brand-name">{t('חתימה דיגיטלית')}</span>
        </div>
        <LangToggle />
      </header>
      <div className="centered-screen">
        <form className="card login-card" onSubmit={submit}>
          <h2>{t('כניסה למערכת')}</h2>
          <label className="field-label" htmlFor="login-user">{t('שם משתמש')}</label>
          <input
            id="login-user"
            className="text-input"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            autoFocus
          />
          <label className="field-label" htmlFor="login-pass" style={{ marginTop: 10 }}>{t('סיסמה')}</label>
          <div className="password-field">
            <input
              id="login-pass"
              className="text-input has-toggle"
              type={showPass ? 'text' : 'password'}
              value={pass}
              onChange={(e) => setPass(e.target.value)}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPass((v) => !v)}
              aria-label={showPass ? t('הסתר סיסמה') : t('הצג סיסמה')}
              aria-pressed={showPass}
            >
              {showPass ? '🙈' : '👁️'}
            </button>
          </div>
          {error && <p className="login-error">{t('שם משתמש או סיסמה שגויים')}</p>}
          <button className="btn-primary full" type="submit" style={{ marginTop: 14 }}>
            {t('התחבר')}
          </button>
        </form>
      </div>
    </div>
  );
}

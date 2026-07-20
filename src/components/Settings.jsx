import { useState } from 'react';
import { getSettings, saveSettings } from '../lib/notify.js';
import { tgDetectChatId, tgSendMessage } from '../lib/telegram.js';
import { waGetState } from '../lib/greenApi.js';
import { useT } from '../lib/i18n.js';

export default function Settings({ onClose }) {
  const t = useT();
  const s = getSettings();
  const [ownerEmail, setOwnerEmail] = useState(s.ownerEmail || '');
  const [webhook, setWebhook] = useState(s.webhook || '');
  const [tgToken, setTgToken] = useState(s.tgToken || '');
  const [tgChatId, setTgChatId] = useState(s.tgChatId || '');
  const [tgBusy, setTgBusy] = useState(''); // ''|'detect'|'test'
  const [tgMsg, setTgMsg] = useState(null); // { ok, text }
  const [waApiUrl, setWaApiUrl] = useState(s.waApiUrl || '');
  const [waInstanceId, setWaInstanceId] = useState(s.waInstanceId || '');
  const [waToken, setWaToken] = useState(s.waToken || '');
  const [waAllowed, setWaAllowed] = useState(s.waAllowed || '');
  const [anthropicKey, setAnthropicKey] = useState(s.anthropicKey || '');
  const [waBusy, setWaBusy] = useState(false);
  const [waMsg, setWaMsg] = useState(null); // { ok, text }

  // fetch() network failures surface as a terse English TypeError — translate.
  const tgError = (e) =>
    /fetch|network/i.test(e.message || '')
      ? t('אין חיבור לטלגרם — בדוק את חיבור האינטרנט ונסה שוב.')
      : e.message;

  const save = () => {
    saveSettings({
      ownerEmail: ownerEmail.trim(),
      webhook: webhook.trim(),
      tgToken: tgToken.trim(),
      tgChatId: tgChatId.trim(),
      waApiUrl: waApiUrl.trim(),
      waInstanceId: waInstanceId.trim(),
      waToken: waToken.trim(),
      waAllowed: waAllowed.trim(),
      anthropicKey: anthropicKey.trim(),
    });
    onClose();
  };

  async function testWhatsApp() {
    if (!waInstanceId.trim() || !waToken.trim()) {
      setWaMsg({ ok: false, text: t('הזן Instance ID וטוקן תחילה.') });
      return;
    }
    setWaBusy(true);
    setWaMsg(null);
    try {
      const st = await waGetState({ apiUrl: waApiUrl, instanceId: waInstanceId, token: waToken });
      if (st?.stateInstance === 'authorized') {
        setWaMsg({ ok: true, text: t('מחובר! הוואטסאפ מקושר ומוכן.') });
      } else {
        setWaMsg({ ok: false, text: t('החיבור תקין אבל הוואטסאפ לא מקושר (סטטוס: {s}). סרוק QR בלוח של Green API.', { s: st?.stateInstance || '?' }) });
      }
    } catch (e) {
      setWaMsg({
        ok: false,
        text: /fetch|network/i.test(e.message || '')
          ? t('אין חיבור ל-Green API — בדוק את הפרטים ואת חיבור האינטרנט.')
          : e.message,
      });
    } finally {
      setWaBusy(false);
    }
  }

  async function detectChat() {
    if (!tgToken.trim()) {
      setTgMsg({ ok: false, text: t('הזן טוקן של בוט תחילה.') });
      return;
    }
    setTgBusy('detect');
    setTgMsg(null);
    try {
      const found = await tgDetectChatId(tgToken);
      if (found) {
        setTgChatId(found.id);
        setTgMsg({ ok: true, text: t('נמצא הצ׳אט של {name}', { name: found.name || found.id }) });
      } else {
        setTgMsg({ ok: false, text: t('לא נמצאו הודעות — שלח לבוט הודעה בטלגרם ונסה שוב.') });
      }
    } catch (e) {
      setTgMsg({ ok: false, text: tgError(e) });
    } finally {
      setTgBusy('');
    }
  }

  async function sendTest() {
    if (!tgToken.trim() || !tgChatId.trim()) {
      setTgMsg({ ok: false, text: t('הזן טוקן ו-Chat ID תחילה.') });
      return;
    }
    setTgBusy('test');
    setTgMsg(null);
    try {
      await tgSendMessage(tgToken, tgChatId, t('הודעת בדיקה ✅ הבוט מחובר לאפליקציית החתימות'));
      setTgMsg({ ok: true, text: t('הודעת הבדיקה נשלחה! בדוק בטלגרם.') });
    } catch (e) {
      setTgMsg({ ok: false, text: tgError(e) });
    } finally {
      setTgBusy('');
    }
  }

  return (
    <div className="modal-backdrop" onPointerDown={onClose}>
      <div className="sign-modal" onPointerDown={(e) => e.stopPropagation()}>
        <div className="sign-modal-head">
          <h3>{t('הגדרות')}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="close">✕</button>
        </div>
        <p className="sign-hint">
          {t('להפעלת שליחה אוטומטית במייל (קישור לחותם + המסמך החתום אליך) — חבר webhook של Make.')}
        </p>
        <label className="field-label">{t('המייל שלך (לקבלת מסמכים חתומים)')}</label>
        <input
          className="text-input"
          type="email"
          dir="ltr"
          placeholder="you@example.com"
          value={ownerEmail}
          onChange={(e) => setOwnerEmail(e.target.value)}
        />
        <label className="field-label" style={{ marginTop: 10 }}>{t('כתובת ה-Webhook של Make')}</label>
        <input
          className="text-input"
          type="url"
          dir="ltr"
          placeholder="https://hook.eu2.make.com/..."
          value={webhook}
          onChange={(e) => setWebhook(e.target.value)}
        />

        <h4 style={{ margin: '18px 0 4px' }}>🤖 {t('בוט טלגרם')}</h4>
        <p className="sign-hint">
          {t('קבל התראות ואת המסמך החתום ישירות לטלגרם. צור בוט אצל @BotFather, הדבק כאן את הטוקן, שלח לבוט הודעה כלשהי ולחץ "מצא Chat ID".')}
        </p>
        <label className="field-label">{t('טוקן הבוט (מ-@BotFather)')}</label>
        <input
          className="text-input"
          type="text"
          dir="ltr"
          autoComplete="off"
          placeholder="123456789:AAF..."
          value={tgToken}
          onChange={(e) => setTgToken(e.target.value)}
        />
        <label className="field-label" style={{ marginTop: 10 }}>Chat ID</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="text-input"
            style={{ flex: 1 }}
            type="text"
            dir="ltr"
            placeholder="123456789"
            value={tgChatId}
            onChange={(e) => setTgChatId(e.target.value)}
          />
          <button className="btn-ghost" disabled={!!tgBusy} onClick={detectChat}>
            {tgBusy === 'detect' ? t('מחפש…') : t('מצא Chat ID')}
          </button>
        </div>
        <div style={{ marginTop: 8 }}>
          <button className="btn-ghost" disabled={!!tgBusy} onClick={sendTest}>
            {tgBusy === 'test' ? t('שולח בדיקה…') : t('שלח הודעת בדיקה')}
          </button>
        </div>
        {tgMsg && (
          <p className="sign-hint" style={{ color: tgMsg.ok ? '#1f7a53' : '#c0392b', marginTop: 8 }}>
            {tgMsg.text}
          </p>
        )}
        <p className="sign-hint" style={{ marginTop: 8 }}>
          {t('שים לב: הטוקן מוטמע בבקשות חתימה — השתמש בבוט ייעודי להתראות בלבד.')}
        </p>

        <h4 style={{ margin: '18px 0 4px' }}>💬 {t('סוכן AI בוואטסאפ')}</h4>
        <p className="sign-hint">
          {t('סוכן חכם שעונה להודעות וואטסאפ בשמך: סטטוס מסמכים, קישורי חתימה ושליחת המסמך החתום. פתחו חשבון ב-green-api.com, צרו Instance, סרקו QR עם הוואטסאפ שלכם והדביקו כאן את הפרטים.')}
        </p>
        <label className="field-label">Instance ID</label>
        <input
          className="text-input"
          type="text"
          dir="ltr"
          autoComplete="off"
          placeholder="1101123456"
          value={waInstanceId}
          onChange={(e) => setWaInstanceId(e.target.value)}
        />
        <label className="field-label" style={{ marginTop: 10 }}>{t('טוקן ה-API של ה-Instance')}</label>
        <input
          className="text-input"
          type="text"
          dir="ltr"
          autoComplete="off"
          placeholder="d75b3a66374942c5b3c019c698abc2067e151558acbd412345"
          value={waToken}
          onChange={(e) => setWaToken(e.target.value)}
        />
        <label className="field-label" style={{ marginTop: 10 }}>{t('כתובת ה-API (רק אם שונה מברירת המחדל)')}</label>
        <input
          className="text-input"
          type="url"
          dir="ltr"
          placeholder="https://api.green-api.com"
          value={waApiUrl}
          onChange={(e) => setWaApiUrl(e.target.value)}
        />
        <label className="field-label" style={{ marginTop: 10 }}>{t('מפתח API של Anthropic (למוח של הסוכן)')}</label>
        <input
          className="text-input"
          type="password"
          dir="ltr"
          autoComplete="off"
          placeholder="sk-ant-..."
          value={anthropicKey}
          onChange={(e) => setAnthropicKey(e.target.value)}
        />
        <label className="field-label" style={{ marginTop: 10 }}>{t('מספרים מורשים (לא חובה, מופרדים בפסיק)')}</label>
        <input
          className="text-input"
          type="text"
          dir="ltr"
          placeholder="972501234567, 972541234567"
          value={waAllowed}
          onChange={(e) => setWaAllowed(e.target.value)}
        />
        <div style={{ marginTop: 8 }}>
          <button className="btn-ghost" disabled={waBusy} onClick={testWhatsApp}>
            {waBusy ? t('בודק…') : t('בדוק חיבור לוואטסאפ')}
          </button>
        </div>
        {waMsg && (
          <p className="sign-hint" style={{ color: waMsg.ok ? '#1f7a53' : '#c0392b', marginTop: 8 }}>
            {waMsg.text}
          </p>
        )}
        <p className="sign-hint" style={{ marginTop: 8 }}>
          {t('המפתחות נשמרים רק בדפדפן הזה. אם לא הוזנו מספרים מורשים — הסוכן יענה לכל מי שכותב לך בפרטי.')}
        </p>

        <div className="sign-actions">
          <button className="btn-primary" onClick={save}>{t('שמור')}</button>
        </div>
      </div>
    </div>
  );
}

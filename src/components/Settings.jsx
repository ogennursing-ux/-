import { useState } from 'react';
import { getSettings, saveSettings } from '../lib/notify.js';
import { tgDetectChatId, tgSendMessage } from '../lib/telegram.js';
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

  const save = () => {
    saveSettings({
      ownerEmail: ownerEmail.trim(),
      webhook: webhook.trim(),
      tgToken: tgToken.trim(),
      tgChatId: tgChatId.trim(),
    });
    onClose();
  };

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
      setTgMsg({ ok: false, text: e.message });
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
      setTgMsg({ ok: false, text: e.message });
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

        <div className="sign-actions">
          <button className="btn-primary" onClick={save}>{t('שמור')}</button>
        </div>
      </div>
    </div>
  );
}

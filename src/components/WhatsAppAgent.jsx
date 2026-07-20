import { useEffect, useState } from 'react';
import { getSettings } from '../lib/notify.js';
import { getAgentState, subscribeAgent, startAgent, stopAgent, agentConfigured } from '../lib/waAgent.js';
import { useT } from '../lib/i18n.js';

export default function WhatsAppAgent({ onOpenSettings }) {
  const t = useT();
  const [agent, setAgent] = useState(getAgentState());
  const [, forceRender] = useState(0);

  useEffect(() => subscribeAgent(() => {
    setAgent({ ...getAgentState() });
  }), []);

  const settings = getSettings();
  const configured = agentConfigured(settings);

  function toggle() {
    if (agent.running) stopAgent();
    else startAgent(getSettings());
    forceRender((n) => n + 1);
  }

  const kindIcon = { in: '📩', out: '🤖', info: 'ℹ️', error: '⚠️' };

  return (
    <div className="dashboard wa-agent">
      <div className="dash-head">
        <h3>
          🤖 {t('סוכן AI בוואטסאפ')}{' '}
          <span className={`badge ${agent.running ? 'ok' : 'muted'}`}>
            {agent.running ? t('פועל') : t('כבוי')}
          </span>
        </h3>
        <div className="dash-controls">
          {configured ? (
            <button className={agent.running ? 'btn-ghost' : 'btn-primary'} onClick={toggle}>
              {agent.running ? t('עצור סוכן') : t('הפעל סוכן')}
            </button>
          ) : (
            <button className="btn-ghost" onClick={onOpenSettings}>
              {t('הגדר בהגדרות ←')}
            </button>
          )}
        </div>
      </div>

      <p className="sign-hint">
        {configured
          ? t('הסוכן עונה להודעות וואטסאפ בשם שלך: סטטוס מסמכים, קישורי חתימה ושליחת ה-PDF החתום. פועל כל עוד הלשונית פתוחה.')
          : t('חבר את הוואטסאפ שלך דרך Green API והוסף מפתח Anthropic בהגדרות — והסוכן יענה להודעות בשמך.')}
      </p>

      {agent.log.length > 0 && (
        <ul className="wa-log">
          {agent.log.map((e, i) => (
            <li key={agent.log.length - i} className={`wa-log-item ${e.kind}`}>
              <span className="wa-log-icon">{kindIcon[e.kind] || ''}</span>
              <span className="wa-log-body">
                {e.chat && <strong>{e.chat}: </strong>}
                {e.text}
              </span>
              <span className="wa-log-time">
                {new Date(e.at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

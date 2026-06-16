import { FIELD_ICONS, FIELD_LABELS } from '../lib/fields.js';

const TOOLS = ['signature', 'text', 'date', 'checkbox'];

// Top toolbar: pick a field tool to place, then download or start over.
export default function Toolbar({ activeTool, onSelectTool, onDownload, onReset, busy, canDownload }) {
  return (
    <div className="toolbar">
      <div className="toolbar-tools">
        {TOOLS.map((tool) => (
          <button
            key={tool}
            className={`tool-btn${activeTool === tool ? ' active' : ''}`}
            onClick={() => onSelectTool(activeTool === tool ? null : tool)}
            title={`הוסף ${FIELD_LABELS[tool]}`}
          >
            <span className="tool-icon" aria-hidden>
              {FIELD_ICONS[tool]}
            </span>
            <span>{FIELD_LABELS[tool]}</span>
          </button>
        ))}
      </div>
      <div className="toolbar-actions">
        <button className="btn-ghost" onClick={onReset} disabled={busy}>
          מסמך חדש
        </button>
        <button className="btn-primary" onClick={onDownload} disabled={busy || !canDownload}>
          {busy ? 'מעבד…' : 'הורד PDF חתום'}
        </button>
      </div>
    </div>
  );
}

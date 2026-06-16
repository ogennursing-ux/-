import { useMemo, useState } from 'react';
import Dropzone from './components/Dropzone.jsx';
import Toolbar from './components/Toolbar.jsx';
import PdfPage from './components/PdfPage.jsx';
import EditPanel from './components/EditPanel.jsx';
import SignaturePad from './components/SignaturePad.jsx';
import { renderPdfPages, buildSignedPdf } from './lib/pdfUtils.js';
import { FIELD_DEFAULTS, clamp, uid, todayISO } from './lib/fields.js';

export default function App() {
  const [pages, setPages] = useState([]);
  const [pdfBytes, setPdfBytes] = useState(null); // original ArrayBuffer (kept intact)
  const [baseName, setBaseName] = useState('document');
  const [fields, setFields] = useState([]);
  const [activeTool, setActiveTool] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [signFor, setSignFor] = useState(null); // field id whose signature pad is open
  const [busy, setBusy] = useState(false);

  const selectedField = useMemo(
    () => fields.find((f) => f.id === selectedId) || null,
    [fields, selectedId],
  );

  async function handleFile(file) {
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    if (!isPdf) {
      alert('יש לבחור קובץ PDF.');
      return;
    }
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      // pdf.js may detach its input, so render from a copy and keep `buf` for pdf-lib.
      const rendered = await renderPdfPages(new Uint8Array(buf.slice(0)));
      setPdfBytes(buf);
      setPages(rendered);
      setBaseName(file.name.replace(/\.pdf$/i, '') || 'document');
      setFields([]);
      setSelectedId(null);
      setActiveTool(null);
    } catch (err) {
      console.error(err);
      alert('לא ניתן לפתוח את הקובץ: ' + err.message);
    } finally {
      setBusy(false);
    }
  }

  function placeField(pageIndex, type, xPct, yPct) {
    const def = FIELD_DEFAULTS[type];
    const field = {
      id: uid(),
      type,
      pageIndex,
      wPct: def.w,
      hPct: def.h,
      xPct: clamp(xPct - def.w / 2, 0, 1 - def.w),
      yPct: clamp(yPct - def.h / 2, 0, 1 - def.h),
      value: type === 'checkbox' ? true : type === 'date' ? todayISO() : '',
    };
    setFields((prev) => [...prev, field]);
    setSelectedId(field.id);
    setActiveTool(null);
    if (type === 'signature') setSignFor(field.id);
  }

  function updateField(id, patch) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function deleteField(id) {
    setFields((prev) => prev.filter((f) => f.id !== id));
    if (selectedId === id) setSelectedId(null);
    if (signFor === id) setSignFor(null);
  }

  function reset() {
    if (fields.length && !confirm('להתחיל מסמך חדש? השדות הנוכחיים יימחקו.')) return;
    setPages([]);
    setPdfBytes(null);
    setFields([]);
    setSelectedId(null);
    setActiveTool(null);
    setSignFor(null);
  }

  async function download() {
    if (!pdfBytes) return;
    setBusy(true);
    try {
      // Pass a copy so the original stays usable for repeated downloads.
      const bytes = await buildSignedPdf(pdfBytes.slice(0), fields);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseName}-signed.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('שגיאה ביצירת ה-PDF: ' + err.message);
    } finally {
      setBusy(false);
    }
  }

  const hasDoc = pages.length > 0;

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">✒️</span>
          <span className="brand-name">חתימה דיגיטלית</span>
        </div>
        {hasDoc && <span className="doc-name">{baseName}.pdf</span>}
      </header>

      {!hasDoc ? (
        <Dropzone onFile={handleFile} busy={busy} />
      ) : (
        <>
          <Toolbar
            activeTool={activeTool}
            onSelectTool={setActiveTool}
            onDownload={download}
            onReset={reset}
            busy={busy}
            canDownload={hasDoc}
          />

          {activeTool && (
            <div className="place-hint">לחץ על המסמך כדי למקם {labelOf(activeTool)}</div>
          )}

          <main
            className="pages"
            onPointerDown={(e) => {
              // Click on empty canvas area clears the selection.
              if (e.target.classList.contains('pages')) setSelectedId(null);
            }}
          >
            {pages.map((page, i) => (
              <PdfPage
                key={i}
                page={page}
                index={i}
                fields={fields}
                activeTool={activeTool}
                selectedId={selectedId}
                onPlace={placeField}
                onSelect={setSelectedId}
                onChange={updateField}
                onDelete={deleteField}
              />
            ))}
          </main>

          <EditPanel
            field={selectedField}
            onChange={updateField}
            onDelete={deleteField}
            onClose={() => setSelectedId(null)}
            onOpenSign={setSignFor}
          />
        </>
      )}

      {signFor && (
        <SignaturePad
          onClose={() => setSignFor(null)}
          onSave={(dataUrl) => {
            if (dataUrl) updateField(signFor, { value: dataUrl });
            setSignFor(null);
          }}
        />
      )}
    </div>
  );
}

function labelOf(tool) {
  return { signature: 'חתימה', text: 'טקסט', date: 'תאריך', checkbox: 'תיבת סימון' }[tool];
}

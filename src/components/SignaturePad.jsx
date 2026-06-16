import { useEffect, useRef } from 'react';

// Crop a canvas to the bounding box of its non-transparent pixels.
// Returns a PNG data URL, or null when nothing was drawn.
function trimCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const { data } = ctx.getImageData(0, 0, width, height);

  let top = null;
  let bottom = 0;
  let left = null;
  let right = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 10) {
        if (top === null) top = y;
        bottom = y;
        if (left === null || x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  if (top === null) return null;

  const pad = 10;
  left = Math.max(0, left - pad);
  top = Math.max(0, top - pad);
  right = Math.min(width - 1, right + pad);
  bottom = Math.min(height - 1, bottom + pad);
  const w = right - left + 1;
  const h = bottom - top + 1;

  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  out.getContext('2d').drawImage(canvas, left, top, w, h, 0, 0, w, h);
  return out.toDataURL('image/png');
}

export default function SignaturePad({ onSave, onClose }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);
  const hasInk = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = '#0b1f33';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const pointFromEvent = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e) => {
    e.preventDefault();
    drawing.current = true;
    last.current = pointFromEvent(e);
    canvasRef.current.setPointerCapture(e.pointerId);
  };

  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const p = pointFromEvent(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    hasInk.current = true;
  };

  const end = (e) => {
    drawing.current = false;
    canvasRef.current.releasePointerCapture?.(e.pointerId);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    hasInk.current = false;
  };

  const save = () => {
    if (!hasInk.current) {
      onSave(null);
      return;
    }
    onSave(trimCanvas(canvasRef.current));
  };

  return (
    <div className="modal-backdrop" onPointerDown={onClose}>
      <div className="sign-modal" onPointerDown={(e) => e.stopPropagation()}>
        <div className="sign-modal-head">
          <h3>חתום כאן</h3>
          <button className="icon-btn" onClick={onClose} aria-label="סגור">
            ✕
          </button>
        </div>
        <p className="sign-hint">צייר את חתימתך באמצעות העכבר או האצבע</p>
        <canvas
          ref={canvasRef}
          className="sign-canvas"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
        />
        <div className="sign-actions">
          <button className="btn-ghost" onClick={clear}>
            נקה
          </button>
          <button className="btn-primary" onClick={save}>
            שמור חתימה
          </button>
        </div>
      </div>
    </div>
  );
}

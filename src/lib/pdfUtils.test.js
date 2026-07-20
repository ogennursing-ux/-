import { describe, it, expect } from 'vitest';
import { formatDate, fieldRect, containRect } from './pdfUtils.js';

describe('formatDate', () => {
  it('reformats an ISO date to dd/mm/yyyy', () => {
    expect(formatDate('2026-01-09')).toBe('09/01/2026');
  });

  it('returns an empty string for empty input', () => {
    expect(formatDate('')).toBe('');
    expect(formatDate(undefined)).toBe('');
    expect(formatDate(null)).toBe('');
  });

  it('passes through a value that is not an ISO date', () => {
    expect(formatDate('09/01/2026')).toBe('09/01/2026');
    expect(formatDate('not a date')).toBe('not a date');
  });

  it('coerces non-string truthy input to a string', () => {
    expect(formatDate(12345)).toBe('12345');
  });
});

describe('fieldRect', () => {
  const page = [600, 800]; // width, height

  it('scales width/height/x from percentages', () => {
    const { boxW, boxH, x } = fieldRect({ wPct: 0.2, hPct: 0.05, xPct: 0.1, yPct: 0 }, ...page);
    expect(boxW).toBeCloseTo(120);
    expect(boxH).toBeCloseTo(40);
    expect(x).toBeCloseTo(60);
  });

  it('flips the y axis to pdf-lib bottom-left origin', () => {
    // A field at the very top (yPct 0) sits its box height below the page top.
    const { y } = fieldRect({ wPct: 0.2, hPct: 0.05, xPct: 0, yPct: 0 }, ...page);
    expect(y).toBeCloseTo(800 - 40); // ph - boxH
  });

  it('places a field at the bottom of the page near y=0', () => {
    // yPct just above (1 - hPct) puts the box flush with the bottom edge.
    const { y } = fieldRect({ wPct: 0.2, hPct: 0.05, xPct: 0, yPct: 0.95 }, ...page);
    expect(y).toBeCloseTo(0);
  });

  it('keeps a mid-page field consistent under the flip', () => {
    // Box centered vertically: top edge at 47.5%, height 5% -> center at 50%.
    const { y, boxH } = fieldRect({ wPct: 0.2, hPct: 0.05, xPct: 0, yPct: 0.475 }, ...page);
    const centerFromBottom = y + boxH / 2;
    expect(centerFromBottom).toBeCloseTo(400); // exactly half of 800
  });
});

describe('containRect', () => {
  it('fits a wide image by width and centers it vertically', () => {
    // 200x100 image into a 100x100 box -> scale 0.5 -> 100x50, centered.
    const r = containRect(200, 100, 10, 20, 100, 100);
    expect(r.width).toBeCloseTo(100);
    expect(r.height).toBeCloseTo(50);
    expect(r.x).toBeCloseTo(10); // no horizontal slack
    expect(r.y).toBeCloseTo(20 + 25); // (100-50)/2 vertical slack
  });

  it('fits a tall image by height and centers it horizontally', () => {
    // 100x200 image into a 100x100 box -> scale 0.5 -> 50x100, centered.
    const r = containRect(100, 200, 0, 0, 100, 100);
    expect(r.width).toBeCloseTo(50);
    expect(r.height).toBeCloseTo(100);
    expect(r.x).toBeCloseTo(25);
    expect(r.y).toBeCloseTo(0);
  });

  it('preserves the source aspect ratio', () => {
    const iw = 300;
    const ih = 90;
    const r = containRect(iw, ih, 0, 0, 120, 120);
    expect(r.width / r.height).toBeCloseTo(iw / ih);
  });
});

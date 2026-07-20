import { describe, it, expect } from 'vitest';
import {
  normalizeSigners,
  isFieldEmpty,
  clamp,
  hexToRgba,
  todayISO,
  uid,
  FIELD_DEFAULTS,
  FIELD_LABELS,
  FIELD_ICONS,
  SHARED_TYPES,
  TEXT_TYPES,
} from './fields.js';

describe('normalizeSigners', () => {
  it('returns the default signer when given nothing', () => {
    const r = normalizeSigners(undefined);
    expect(r.current).toBe(0);
    expect(r.list).toHaveLength(1);
    expect(r.list[0].name).toBe('החותם');
    expect(r.note).toBe('');
  });

  it('treats null the same as undefined', () => {
    expect(normalizeSigners(null)).toEqual(normalizeSigners(undefined));
  });

  it('wraps a non-empty array into { current, list, note }', () => {
    const list = [{ name: 'A' }, { name: 'B' }];
    expect(normalizeSigners(list)).toEqual({ current: 0, list, note: '' });
  });

  it('falls back to the default list for an empty array', () => {
    const r = normalizeSigners([]);
    expect(r.list).toHaveLength(1);
    expect(r.list[0].name).toBe('החותם');
  });

  it('keeps note but uses the default list when list is missing', () => {
    const r = normalizeSigners({ note: 'hello' });
    expect(r.note).toBe('hello');
    expect(r.list[0].name).toBe('החותם');
    expect(r.current).toBe(0);
  });

  it('passes through a full object and defaults current to 0', () => {
    const list = [{ name: 'X' }];
    expect(normalizeSigners({ list, note: 'n' })).toEqual({ current: 0, list, note: 'n' });
  });

  it('preserves an explicit current index', () => {
    const list = [{ name: 'X' }, { name: 'Y' }];
    expect(normalizeSigners({ current: 1, list })).toEqual({ current: 1, list, note: '' });
  });
});

describe('isFieldEmpty', () => {
  it('treats a checkbox as empty unless it is exactly true', () => {
    expect(isFieldEmpty({ type: 'checkbox', value: true })).toBe(false);
    expect(isFieldEmpty({ type: 'checkbox', value: false })).toBe(true);
    expect(isFieldEmpty({ type: 'checkbox', value: 'true' })).toBe(true);
    expect(isFieldEmpty({ type: 'checkbox', value: undefined })).toBe(true);
  });

  it('treats a text-like field as empty when it has no value', () => {
    expect(isFieldEmpty({ type: 'text', value: '' })).toBe(true);
    expect(isFieldEmpty({ type: 'text', value: undefined })).toBe(true);
    expect(isFieldEmpty({ type: 'text', value: 'hi' })).toBe(false);
    expect(isFieldEmpty({ type: 'signature', value: 'data:...' })).toBe(false);
  });
});

describe('clamp', () => {
  it('returns the value inside the range untouched', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });
  it('clamps to the bounds', () => {
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });
  it('handles the value sitting exactly on a bound', () => {
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });
});

describe('hexToRgba', () => {
  it('converts a #rrggbb color with alpha', () => {
    expect(hexToRgba('#1f7a53', 0.5)).toBe('rgba(31, 122, 83, 0.5)');
  });
  it('works without the leading hash', () => {
    expect(hexToRgba('2563eb', 1)).toBe('rgba(37, 99, 235, 1)');
  });
  it('handles black and white', () => {
    expect(hexToRgba('#000000', 0)).toBe('rgba(0, 0, 0, 0)');
    expect(hexToRgba('#ffffff', 1)).toBe('rgba(255, 255, 255, 1)');
  });
});

describe('todayISO', () => {
  it('returns a zero-padded yyyy-mm-dd string', () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it('matches the current date', () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    expect(todayISO()).toBe(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
  });
});

describe('uid', () => {
  it('produces unique, non-empty ids', () => {
    const a = uid();
    const b = uid();
    expect(a).toBeTruthy();
    expect(a).not.toBe(b);
  });
});

describe('field metadata tables', () => {
  it('has a default size, label and icon for every field type', () => {
    for (const type of Object.keys(FIELD_DEFAULTS)) {
      expect(FIELD_LABELS[type]).toBeTruthy();
      expect(FIELD_ICONS[type]).toBeTruthy();
      expect(FIELD_DEFAULTS[type].w).toBeGreaterThan(0);
      expect(FIELD_DEFAULTS[type].h).toBeGreaterThan(0);
    }
  });

  it('only lists known field types in SHARED_TYPES and TEXT_TYPES', () => {
    const known = new Set(Object.keys(FIELD_DEFAULTS));
    for (const t of SHARED_TYPES) expect(known.has(t)).toBe(true);
    for (const t of TEXT_TYPES) expect(known.has(t)).toBe(true);
  });
});

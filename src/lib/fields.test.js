import { describe, it, expect } from 'vitest';
import {
  normalizeSigners,
  isFieldEmpty,
  clamp,
  hexToRgba,
  todayISO,
  uid,
  joinName,
  computeFieldValue,
  countMissingRequired,
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

describe('joinName', () => {
  it('joins first and last with a space', () => {
    expect(joinName('דנה', 'כהן')).toBe('דנה כהן');
  });
  it('skips a blank part', () => {
    expect(joinName('דנה', '')).toBe('דנה');
    expect(joinName('', 'כהן')).toBe('כהן');
    expect(joinName(undefined, 'כהן')).toBe('כהן');
  });
  it('returns an empty string when both are blank', () => {
    expect(joinName('', '')).toBe('');
  });
});

describe('computeFieldValue', () => {
  const shared = {
    firstName: 'דנה',
    lastName: 'כהן',
    fullName: '',
    idNumber: '123456782',
    initials: 'ד.כ',
    signature: 'data:image/png;base64,AAAA',
  };

  it('reads each shared identity field from the shared object', () => {
    expect(computeFieldValue({ type: 'signature' }, shared)).toBe('data:image/png;base64,AAAA');
    expect(computeFieldValue({ type: 'initials' }, shared)).toBe('ד.כ');
    expect(computeFieldValue({ type: 'firstName' }, shared)).toBe('דנה');
    expect(computeFieldValue({ type: 'lastName' }, shared)).toBe('כהן');
    expect(computeFieldValue({ type: 'idNumber' }, shared)).toBe('123456782');
  });

  it('derives fullName from first+last when not explicitly set', () => {
    expect(computeFieldValue({ type: 'fullName' }, shared)).toBe('דנה כהן');
  });

  it('prefers an explicit fullName over the derived one', () => {
    expect(computeFieldValue({ type: 'fullName' }, { ...shared, fullName: 'ד. כהן' })).toBe('ד. כהן');
  });

  it('reads text-like fields from perField by id', () => {
    const f = { id: 'x1', type: 'text' };
    expect(computeFieldValue(f, shared, { x1: 'שלום' })).toBe('שלום');
  });

  it('falls back to an existing field value, then empty string', () => {
    expect(computeFieldValue({ id: 'x', type: 'date', value: '2026-01-01' }, shared, {})).toBe('2026-01-01');
    expect(computeFieldValue({ id: 'y', type: 'text' }, shared, {})).toBe('');
  });

  it('returns empty strings for missing shared values instead of undefined', () => {
    expect(computeFieldValue({ type: 'firstName' }, {})).toBe('');
    expect(computeFieldValue({ type: 'signature' }, {})).toBe('');
  });
});

describe('countMissingRequired', () => {
  it('counts only required, empty fields', () => {
    const fields = [
      { type: 'text', required: true, value: '' },      // missing
      { type: 'text', required: true, value: 'ok' },    // filled
      { type: 'text', required: false, value: '' },     // not required
      { type: 'checkbox', required: true, value: false },// missing
      { type: 'checkbox', required: true, value: true }, // filled
    ];
    expect(countMissingRequired(fields)).toBe(2);
  });

  it('returns 0 when nothing is required', () => {
    expect(countMissingRequired([{ type: 'text', value: '' }])).toBe(0);
  });

  it('returns 0 for an empty field list', () => {
    expect(countMissingRequired([])).toBe(0);
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

import { describe, it, expect } from 'vitest';
import { parseRanges, toCsv } from './exporters.js';

describe('parseRanges', () => {
  it('parses a single page to a 0-based index', () => {
    expect(parseRanges('3', 10)).toEqual([2]);
  });

  it('parses a simple range inclusively', () => {
    expect(parseRanges('1-3', 10)).toEqual([0, 1, 2]);
  });

  it('parses a mix of ranges and singles', () => {
    expect(parseRanges('1-3,5', 10)).toEqual([0, 1, 2, 4]);
  });

  it('normalizes a reversed range', () => {
    expect(parseRanges('5-1', 10)).toEqual([0, 1, 2, 3, 4]);
  });

  it('clamps values above max away', () => {
    expect(parseRanges('8-12', 10)).toEqual([7, 8, 9]);
  });

  it('drops page 0 and negative-looking junk', () => {
    expect(parseRanges('0,2', 10)).toEqual([1]);
  });

  it('deduplicates overlapping ranges and singles', () => {
    expect(parseRanges('1-3,2,3-4', 10)).toEqual([0, 1, 2, 3]);
  });

  it('ignores surrounding whitespace', () => {
    expect(parseRanges(' 1 - 2 , 4 ', 10)).toEqual([0, 1, 3]);
  });

  it('returns an empty array for empty or garbage input', () => {
    expect(parseRanges('', 10)).toEqual([]);
    expect(parseRanges('abc', 10)).toEqual([]);
    expect(parseRanges(',,', 10)).toEqual([]);
  });

  it('coerces a numeric argument to a string', () => {
    expect(parseRanges(3, 10)).toEqual([2]);
  });

  it('returns nothing when max is 0', () => {
    expect(parseRanges('1-5', 0)).toEqual([]);
  });
});

describe('toCsv', () => {
  it('starts with a UTF-8 BOM so Excel reads Hebrew correctly', () => {
    expect(toCsv([]).charCodeAt(0)).toBe(0xfeff);
  });

  it('emits the header row', () => {
    const csv = toCsv([]);
    expect(csv).toContain('"שם המסמך","סטטוס","תאריך"');
  });

  it('renders a data row with CRLF line endings', () => {
    const csv = toCsv([{ title: 'חוזה', status: 'signed', date: '2026-01-01' }]);
    expect(csv).toContain('\r\n"חוזה","signed","2026-01-01"');
  });

  it('escapes embedded double quotes by doubling them', () => {
    const csv = toCsv([{ title: 'a"b', status: 's', date: 'd' }]);
    expect(csv).toContain('"a""b"');
  });

  it('renders null/undefined cells as empty strings', () => {
    const csv = toCsv([{ title: null, status: undefined, date: '' }]);
    expect(csv).toContain('"","",""');
  });
});

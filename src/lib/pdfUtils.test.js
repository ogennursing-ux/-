import { describe, it, expect } from 'vitest';
import { formatDate } from './pdfUtils.js';

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

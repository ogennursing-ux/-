import { describe, it, expect, afterEach } from 'vitest';
import { translate, getInitialLang, applyLang } from './i18n.js';

describe('translate', () => {
  it('returns the Hebrew key unchanged in Hebrew mode', () => {
    expect(translate('he', 'חתימה דיגיטלית')).toBe('חתימה דיגיטלית');
  });

  it('looks up the English translation in English mode', () => {
    expect(translate('en', 'חתימה דיגיטלית')).toBe('Digital Signature');
  });

  it('falls back to the Hebrew key when no English translation exists', () => {
    expect(translate('en', 'מחרוזת שלא קיימת בכלל')).toBe('מחרוזת שלא קיימת בכלל');
  });

  it('substitutes a single placeholder', () => {
    expect(translate('he', 'שלום {name}', { name: 'דנה' })).toBe('שלום דנה');
  });

  it('substitutes every occurrence of a placeholder', () => {
    expect(translate('he', '{x}-{x}', { x: 'a' })).toBe('a-a');
  });

  it('substitutes placeholders after translating to English', () => {
    // 'הוסף {label}' -> 'Add {label}' in EN
    expect(translate('en', 'הוסף {label}', { label: 'Text' })).toBe('Add Text');
  });

  it('leaves unreferenced placeholders in place', () => {
    expect(translate('he', 'שלום {name}', {})).toBe('שלום {name}');
  });
});

describe('getInitialLang', () => {
  afterEach(() => localStorage.clear());

  it('defaults to Hebrew when nothing is stored', () => {
    expect(getInitialLang()).toBe('he');
  });

  it('reads a stored language preference', () => {
    localStorage.setItem('lang', 'en');
    expect(getInitialLang()).toBe('en');
  });
});

describe('applyLang', () => {
  it('sets document dir/lang to RTL Hebrew', () => {
    applyLang('he');
    expect(document.documentElement.lang).toBe('he');
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('sets document dir/lang to LTR English', () => {
    applyLang('en');
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
  });
});

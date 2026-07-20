import { describe, it, expect, beforeEach } from 'vitest';
import {
  rememberRequest,
  listMyRequests,
  forgetRequest,
  rememberTemplate,
  listMyTemplates,
  forgetTemplate,
  signingLink,
  formLink,
} from './api.js';

beforeEach(() => localStorage.clear());

describe('request history (localStorage)', () => {
  it('starts empty', () => {
    expect(listMyRequests()).toEqual([]);
  });

  it('remembers a request, newest first', () => {
    rememberRequest({ id: 'a' });
    rememberRequest({ id: 'b' });
    expect(listMyRequests().map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('forgets a request by id', () => {
    rememberRequest({ id: 'a' });
    rememberRequest({ id: 'b' });
    forgetRequest('a');
    expect(listMyRequests().map((r) => r.id)).toEqual(['b']);
  });

  it('forgetting an unknown id is a no-op', () => {
    rememberRequest({ id: 'a' });
    forgetRequest('zzz');
    expect(listMyRequests()).toHaveLength(1);
  });

  it('caps history at 100 entries', () => {
    for (let i = 0; i < 130; i++) rememberRequest({ id: `r${i}` });
    const list = listMyRequests();
    expect(list).toHaveLength(100);
    // newest kept, oldest dropped
    expect(list[0].id).toBe('r129');
    expect(list.some((r) => r.id === 'r0')).toBe(false);
  });

  it('returns an empty array when the stored value is corrupt', () => {
    localStorage.setItem('my_sign_requests', '{not json');
    expect(listMyRequests()).toEqual([]);
  });
});

describe('template history (localStorage)', () => {
  it('remembers, lists and forgets templates independently of requests', () => {
    rememberRequest({ id: 'req' });
    rememberTemplate({ id: 't1' });
    rememberTemplate({ id: 't2' });
    expect(listMyTemplates().map((t) => t.id)).toEqual(['t2', 't1']);
    forgetTemplate('t1');
    expect(listMyTemplates().map((t) => t.id)).toEqual(['t2']);
    // requests untouched
    expect(listMyRequests().map((r) => r.id)).toEqual(['req']);
  });
});

describe('link builders', () => {
  it('builds a signing link with the req query param', () => {
    const base = `${location.origin}${location.pathname}`;
    expect(signingLink('abc')).toBe(`${base}?req=abc`);
  });

  it('builds a form link with the form query param', () => {
    const base = `${location.origin}${location.pathname}`;
    expect(formLink('tpl1')).toBe(`${base}?form=tpl1`);
  });
});

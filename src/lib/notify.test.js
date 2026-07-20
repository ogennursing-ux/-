import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  packNotifyTarget,
  unpackNotifyTarget,
  bytesToBase64,
  getSettings,
  saveSettings,
  notify,
} from './notify.js';

describe('packNotifyTarget / unpackNotifyTarget', () => {
  it('returns a plain URL string when only a webhook is set', () => {
    expect(packNotifyTarget({ webhook: 'https://hook.test' })).toBe('https://hook.test');
  });

  it('returns null when nothing is configured', () => {
    expect(packNotifyTarget({})).toBe(null);
    expect(packNotifyTarget()).toBe(null);
  });

  it('packs webhook + telegram into JSON when both telegram fields exist', () => {
    const packed = packNotifyTarget({
      webhook: 'https://hook.test',
      tgToken: 'tok',
      tgChatId: 123,
    });
    expect(packed).toBe(JSON.stringify({
      v: 1,
      webhook: 'https://hook.test',
      telegram: { token: 'tok', chatId: '123' },
    }));
  });

  it('packs telegram with a null webhook when webhook is absent', () => {
    const packed = packNotifyTarget({ tgToken: 'tok', tgChatId: 'c' });
    expect(JSON.parse(packed).webhook).toBe(null);
    expect(JSON.parse(packed).telegram).toEqual({ token: 'tok', chatId: 'c' });
  });

  it('ignores a token without a chat id (and vice versa)', () => {
    expect(packNotifyTarget({ webhook: 'https://h', tgToken: 'tok' })).toBe('https://h');
    expect(packNotifyTarget({ webhook: 'https://h', tgChatId: 'c' })).toBe('https://h');
  });

  it('trims whitespace around the webhook', () => {
    expect(packNotifyTarget({ webhook: '  https://h  ' })).toBe('https://h');
  });

  it('unpacks a plain URL as a webhook with no telegram (backward compatible)', () => {
    expect(unpackNotifyTarget('https://hook.test')).toEqual({
      webhook: 'https://hook.test',
      telegram: null,
    });
  });

  it('unpacks empty/nullish input to no targets', () => {
    expect(unpackNotifyTarget('')).toEqual({ webhook: null, telegram: null });
    expect(unpackNotifyTarget(null)).toEqual({ webhook: null, telegram: null });
    expect(unpackNotifyTarget('   ')).toEqual({ webhook: null, telegram: null });
  });

  it('unpacks packed JSON back into its parts', () => {
    const raw = '{"v":1,"webhook":"https://h","telegram":{"token":"t","chatId":"c"}}';
    expect(unpackNotifyTarget(raw)).toEqual({
      webhook: 'https://h',
      telegram: { token: 't', chatId: 'c' },
    });
  });

  it('returns no targets for malformed JSON rather than throwing', () => {
    expect(unpackNotifyTarget('{not json')).toEqual({ webhook: null, telegram: null });
  });

  it('round-trips a webhook-only config', () => {
    const packed = packNotifyTarget({ webhook: 'https://h' });
    expect(unpackNotifyTarget(packed).webhook).toBe('https://h');
  });

  it('round-trips a combined config', () => {
    const settings = { webhook: 'https://h', tgToken: 't', tgChatId: 'c' };
    const { webhook, telegram } = unpackNotifyTarget(packNotifyTarget(settings));
    expect(webhook).toBe('https://h');
    expect(telegram).toEqual({ token: 't', chatId: 'c' });
  });
});

describe('bytesToBase64', () => {
  it('encodes a small byte array', () => {
    // "Hi" -> SGk=
    expect(bytesToBase64(new Uint8Array([72, 105]))).toBe('SGk=');
  });

  it('accepts an ArrayBuffer', () => {
    expect(bytesToBase64(new Uint8Array([72, 105]).buffer)).toBe('SGk=');
  });

  it('encodes payloads larger than the 0x8000 chunk boundary correctly', () => {
    const big = new Uint8Array(0x8000 * 2 + 5).fill(65); // 'A' repeated
    const b64 = bytesToBase64(big);
    // decoding must reproduce the original bytes exactly
    const decoded = atob(b64);
    expect(decoded.length).toBe(big.length);
    expect(decoded[0]).toBe('A');
    expect(decoded[decoded.length - 1]).toBe('A');
  });
});

describe('getSettings / saveSettings', () => {
  it('returns an empty object when nothing is stored', () => {
    expect(getSettings()).toEqual({});
  });

  it('persists and reloads settings', () => {
    saveSettings({ webhook: 'https://h', tgToken: 't' });
    expect(getSettings()).toEqual({ webhook: 'https://h', tgToken: 't' });
  });

  it('returns an empty object for corrupt stored JSON', () => {
    localStorage.setItem('owner_settings', '{broken');
    expect(getSettings()).toEqual({});
  });
});

describe('notify', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns false immediately when no webhook is given', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    expect(await notify('', { a: 1 })).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it('POSTs JSON to the webhook and returns true on success', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({});
    const ok = await notify('https://hook.test', { hello: 'world' });
    expect(ok).toBe(true);
    expect(spy).toHaveBeenCalledWith(
      'https://hook.test',
      expect.objectContaining({
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({ hello: 'world' }),
      }),
    );
  });

  it('never throws and returns false when fetch rejects', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await notify('https://hook.test', {})).toBe(false);
  });
});

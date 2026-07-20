import { describe, it, expect, beforeEach } from 'vitest';
import { mockApi } from './mockApi.js';

beforeEach(() => localStorage.clear());

const bytes = () => new Uint8Array([1, 2, 3, 4, 5]);
const toArr = (buf) => Array.from(new Uint8Array(buf));

describe('mockApi requests', () => {
  it('creates a request and reads it back with original bytes intact', async () => {
    const { id } = await mockApi.createRequest({
      title: 'חוזה',
      pdfBytes: bytes(),
      fields: [{ id: 'f1' }],
      signers: { list: [{ name: 'A' }] },
    });
    expect(id).toBeTruthy();

    const req = await mockApi.getRequest(id);
    expect(req.title).toBe('חוזה');
    expect(req.status).toBe('sent');

    const original = await mockApi.getOriginalBytes(req);
    expect(toArr(original)).toEqual([1, 2, 3, 4, 5]);
  });

  it('throws a Hebrew error for an unknown request id', async () => {
    await expect(mockApi.getRequest('nope')).rejects.toThrow('הבקשה לא נמצאה');
  });

  it('advances fields/signers on an existing request', async () => {
    const { id } = await mockApi.createRequest({ pdfBytes: bytes(), fields: [], signers: {} });
    await mockApi.advance(id, { fields: [{ id: 'x' }], signers: { current: 1 } });
    const req = await mockApi.getRequest(id);
    expect(req.fields).toEqual([{ id: 'x' }]);
    expect(req.signers).toEqual({ current: 1 });
  });

  it('submits a signed pdf and flips status to signed', async () => {
    const { id } = await mockApi.createRequest({ pdfBytes: bytes(), fields: [], signers: {} });
    await mockApi.submitSigned(id, { fields: [], signers: {}, signedPdfBytes: new Uint8Array([9, 9]) });
    const req = await mockApi.getRequest(id);
    expect(req.status).toBe('signed');
    expect(req.signed_at).toBeTruthy();
    expect(toArr(await mockApi.getSignedBytes(req))).toEqual([9, 9]);
  });

  it('deletes a request', async () => {
    const { id } = await mockApi.createRequest({ pdfBytes: bytes(), fields: [], signers: {} });
    await mockApi.deleteRequest(id);
    await expect(mockApi.getRequest(id)).rejects.toThrow();
  });

  it('lists only signed requests, newest first', async () => {
    const a = await mockApi.createRequest({ pdfBytes: bytes(), fields: [], signers: {} });
    const b = await mockApi.createRequest({ pdfBytes: bytes(), fields: [], signers: {} });
    await mockApi.submitSigned(a.id, { fields: [], signers: {}, signedPdfBytes: bytes() });
    const signed = await mockApi.listAllSigned();
    expect(signed.map((r) => r.id)).toEqual([a.id]);
    expect(signed.some((r) => r.id === b.id)).toBe(false);
  });
});

describe('mockApi templates & forms', () => {
  it('creates a template and reads it back', async () => {
    const { id } = await mockApi.createTemplate({
      title: 'טופs',
      pdfBytes: bytes(),
      fields: [],
      signers: [{ name: 'S' }],
      note: 'הערה',
    });
    const t = await mockApi.getTemplate(id);
    expect(t.title).toBe('טופs');
    expect(t.signers).toEqual({ list: [{ name: 'S' }], note: 'הערה' });
  });

  it('throws for an unknown template id', async () => {
    await expect(mockApi.getTemplate('nope')).rejects.toThrow('התבנית לא נמצאה');
  });

  it('resolves original bytes for a form row via its template', async () => {
    const tpl = await mockApi.createTemplate({ pdfBytes: bytes(), fields: [], signers: [] });
    const template = await mockApi.getTemplate(tpl.id);
    const { id } = await mockApi.submitForm(template, {
      fields: [],
      signedPdfBytes: new Uint8Array([7]),
    });
    const req = await mockApi.getRequest(id);
    expect(req.template_id).toBe(tpl.id);
    expect(req.status).toBe('signed');
    // pdf_b64 is carried from the template, so original bytes resolve
    expect(toArr(await mockApi.getOriginalBytes(req))).toEqual([1, 2, 3, 4, 5]);
  });

  it('lists submissions for a template, newest first', async () => {
    const tpl = await mockApi.createTemplate({ pdfBytes: bytes(), fields: [], signers: [] });
    const template = await mockApi.getTemplate(tpl.id);
    const s1 = await mockApi.submitForm(template, { fields: [], signedPdfBytes: bytes() });
    const s2 = await mockApi.submitForm(template, { fields: [], signedPdfBytes: bytes() });
    const subs = await mockApi.listSubmissions(tpl.id);
    expect(subs.map((r) => r.id).sort()).toEqual([s1.id, s2.id].sort());
    expect(subs).toHaveLength(2);
  });

  it('deletes a template', async () => {
    const tpl = await mockApi.createTemplate({ pdfBytes: bytes(), fields: [], signers: [] });
    await mockApi.deleteTemplate(tpl.id);
    await expect(mockApi.getTemplate(tpl.id)).rejects.toThrow();
  });
});

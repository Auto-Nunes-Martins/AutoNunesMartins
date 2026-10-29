import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { contactEmailHtml } from './contactEmail';
import { contactEmailLogoAttachment, contactEmailLogoId } from './contactEmailLogo';
const data = {
  name: 'Ana & João',
  email: 'ana@example.org',
  subject: 'Marcar uma visita',
  message: 'Olá, equipa!\n\nTenho interesse nesta viatura.',
  page: '/viaturas/bmw-serie-3-012345abcdef',
};
describe('internal contact HTML email', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('keeps every field, vehicle reference, reply action and multiline message', () => {
    const html = contactEmailHtml(data);
    expect(html).toContain('Ana &amp; João');
    expect(html).toContain(data.page);
    expect(html).toContain('Referência da viatura');
    expect(html).toContain('Olá, equipa!<br><br>Tenho interesse');
    expect(html).toContain('mailto:ana%40example.org');
    expect(html).toContain('Um pedido de visita não constitui um agendamento confirmado.');
    expect(html).not.toMatch(
      /<script|<iframe|<form|https?:\/\/|localhost|@font-face|@import|url\(/i,
    );
  });
  it('escapes all visitor fields instead of interpreting HTML or injected links', () => {
    const html = contactEmailHtml({
      ...data,
      name: '<img src=x onerror="alert(1)">',
      subject: '<script>alert("x")</script>',
      message: '<a href="javascript:alert(1)">Olá</a>\r\n" & \'',
      page: '/contacto',
    });
    expect(html).not.toContain('<script>');
    expect([...html.matchAll(/<img\b/g)]).toHaveLength(1);
    expect(html).not.toContain('<a href="javascript:');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;a href=&quot;javascript:alert(1)&quot;&gt;');
    expect(html).toContain('<br>&quot; &amp; &#39;');
    expect(html).toContain('Página de origem');
  });
  it('uses a fluid table layout and local font fallbacks without tracking resources', () => {
    const html = contactEmailHtml({ ...data, message: 'Palavra'.repeat(600) });
    expect(html).toContain('max-width:640px');
    expect(html).toContain('table-layout:fixed');
    expect(html).toContain('font-family:Arial,Helvetica,sans-serif');
    expect(html).toContain('<!--[if mso]>');
    expect(html).toContain('@media only screen and (max-width:600px)');
    expect(html).toContain('display:block !important; width:100% !important;');
    for (const href of html.matchAll(/href="([^"]*)"/g)) expect(href[1]).toMatch(/^mailto:/);
  });
  it('always references the real inline logo without a public website URL', () => {
    vi.stubEnv('PUBLIC_WEBSITE_URL', '');
    const html = contactEmailHtml(data);
    expect([...html.matchAll(/<img\b/g)]).toHaveLength(1);
    expect(html).toContain(`src="cid:${contactEmailLogoId}"`);
    expect(html).toContain('alt="Auto Nunes Martins"');
    expect(html).not.toMatch(/https?:\/\/|data:image|@font-face/i);
  });
  it('embeds the email PNG, cropping only empty horizontal space from the website logo', async () => {
    const attachment = contactEmailLogoAttachment();
    expect(attachment).toMatchObject({
      filename: 'auto-nunes-martins.png',
      content_type: 'image/png',
      content_id: contactEmailLogoId,
    });
    const source = readFileSync(
      new URL('../../../../apps/website/static/logo-transparent-white-v3.png', import.meta.url),
    );
    const original = readFileSync(new URL('./contactEmailLogo.png', import.meta.url));
    expect(Buffer.from(attachment.content, 'base64')).toEqual(original);
    const full = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const crop = await sharp(original).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let left = full.info.width,
      right = -1;
    for (let y = 0; y < full.info.height; y++)
      for (let x = 0; x < full.info.width; x++) {
        if (full.data[(y * full.info.width + x) * 4 + 3]) {
          left = Math.min(left, x);
          right = Math.max(right, x);
        }
      }
    expect(crop.info.width).toBe(right - left + 1);
    expect(crop.info.height).toBe(full.info.height);
    const expected = await sharp(source)
      .extract({ left, top: 0, width: right - left + 1, height: full.info.height })
      .flatten({ background: '#0b0c0d' })
      .ensureAlpha()
      .raw()
      .toBuffer();
    expect(crop.data.equals(expected)).toBe(true);
    expect(crop.data.every((value, index) => index % 4 !== 3 || value === 255)).toBe(true);
    expect(attachment).not.toHaveProperty('path');
    expect(original.length).toBeLessThan(300_000);
    expect(JSON.stringify(contactEmailLogoAttachment())).toBe(JSON.stringify(attachment));
  });
  it('asks current Gmail to preserve the authored dark palette without a light redesign', () => {
    const html = contactEmailHtml(data);
    expect(html).toContain('<meta name="color-scheme" content="light only">');
    for (const color of ['#101112', '#0b0c0d', '#191b1c', '#242627', '#141617']) {
      expect(html).toContain(`background-color:${color}`);
      expect(html).toContain(`bgcolor="${color}"`);
    }
    expect(html).toContain('color:#f1f2ef');
    expect(html).not.toContain('prefers-color-scheme');
  });
  it('keeps a readable alternative presentation for previews without images', () => {
    const html = contactEmailHtml(data, { logo: false });
    expect(html).not.toContain('<img');
    expect(html).toContain('AUTO NUNES MARTINS');
    expect(html).toContain('Responder ao contacto');
  });
  it('escapes reply addresses and reference text with the inline image present', () => {
    const html = contactEmailHtml({
      ...data,
      email: 'a"&b@example.org',
      page: '/"><script>alert(1)</script>',
    });
    expect([...html.matchAll(/<img\b/g)]).toHaveLength(1);
    expect(html).not.toContain('<script>');
    expect(html).toContain('mailto:a%22%26b%40example.org');
    expect(html).toContain('/&quot;&gt;&lt;script&gt;');
  });
});

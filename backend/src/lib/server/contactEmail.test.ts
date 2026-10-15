import { describe, it, expect } from 'vitest';
import { contactEmailHtml } from './contactEmail';
const data = {
  name: 'Ana & João',
  email: 'ana@example.org',
  subject: 'Marcar uma visita',
  message: 'Olá, equipa!\n\nTenho interesse nesta viatura.',
  page: '/viaturas/bmw-serie-3-012345abcdef',
};
describe('internal contact HTML email', () => {
  it('keeps all available fields, vehicle reference, reply action and multiline message', () => {
    const html = contactEmailHtml(data);
    expect(html).toContain('Ana &amp; João');
    expect(html).toContain(data.page);
    expect(html).toContain('Referência da viatura');
    expect(html).toContain('Olá, equipa!<br><br>Tenho interesse');
    expect(html).toContain('mailto:ana%40example.org');
    expect(html).toContain('Um pedido de visita não constitui um agendamento confirmado.');
    expect(html).not.toMatch(/<img|<script|<iframe|<form|https?:\/\/|localhost|onerror=/i);
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
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<a href="javascript:');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;a href=&quot;javascript:alert(1)&quot;&gt;');
    expect(html).toContain('<br>&quot; &amp; &#39;');
    expect(html).toContain('Página de origem');
  });
  it('uses a self-contained responsive presentation without tracking resources', () => {
    const html = contactEmailHtml({ ...data, message: 'Palavra'.repeat(600) });
    expect(html).toContain('max-width:600px');
    expect(html).toContain('table-layout:fixed');
    expect(html).toContain('font-family:Arial,Helvetica,sans-serif');
    expect(html).toContain('<!--[if mso]>');
    for (const href of html.matchAll(/href="([^"]*)"/g)) expect(href[1]).toMatch(/^mailto:/);
  });
});

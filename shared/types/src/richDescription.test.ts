import { describe, expect, it } from 'vitest';
import { descriptionHtml, descriptionPreviewHtml, descriptionText, encodeDescription, RICH_DESCRIPTION_PREFIX, safeDescriptionHref, sanitizeDescriptionHtml } from './richDescription';

describe('public description formatting', () => {
  it('keeps old text and paragraphs readable and makes existing source URLs clickable', () => {
    const html = descriptionHtml('Histórico < 3 anos & manutenção.\n\nFonte: https://example.com/viatura?a=1&b=2.');
    expect(html).toContain('Histórico &lt; 3 anos &amp; manutenção.');
    expect(html).toContain('href="https://example.com/viatura?a=1&amp;b=2"');
    expect(html).toContain('</a>.');
  });
  it('supports existing basic HTML and round trips visual editor formatting', () => {
    const html = '<h3>Manutenção</h3><p><strong>Revisão</strong> <em>recente</em> <u>confirmada</u>.</p><ul><li>Livro</li><li><a href="https://example.com">Informação</a></li></ul>';
    const stored = encodeDescription(html);
    expect(stored.startsWith(RICH_DESCRIPTION_PREFIX)).toBe(true);
    expect(descriptionHtml(stored)).toContain('<strong>Revisão</strong>');
    expect(descriptionHtml(html)).toContain('href="https://example.com/"');
    expect(descriptionText(stored)).toContain('Revisão recente confirmada.');
    expect(descriptionText(stored)).not.toContain('<strong>');
    expect(encodeDescription('<p><br></p>')).toBe('');
  });
  it('rebuilds safe HTML rather than trusting tags, attributes or encoded protocols', () => {
    const input = '<p onclick="alert(1)">Texto<img src=x onerror=alert(1)><svg><script>alert(1)</script></svg><style>body{display:none}</style><iframe srcdoc="evil"></iframe><a href="java&#x0a;script:alert(1)">Ligação</a><strong style="color:red" data-x="x">Forte</strong></p>';
    expect(sanitizeDescriptionHtml(input)).toBe('<p>TextoLigação<strong>Forte</strong></p>');
    expect(descriptionHtml(RICH_DESCRIPTION_PREFIX + '<math><mtext><img src=x onerror=alert(1)></mtext></math><p>Seguro</p>')).toBe('<p>Seguro</p>');
    for (const href of ['javascript:alert(1)', 'data:text/html,evil', '//example.com', 'https://user:secret@example.com', 'https://example.com/\nattack']) expect(safeDescriptionHref(href)).toBeNull();
  });
  it('bounds nesting and keeps escaped text from turning into HTML on reparsing', () => {
    expect(sanitizeDescriptionHtml('<p>&lt;img src=x onerror=alert(1)&gt;</p>')).toBe('<p>&lt;img src=x onerror=alert(1)&gt;</p>');
    expect(() => sanitizeDescriptionHtml('<div>'.repeat(200) + 'Texto' + '</div>'.repeat(200))).not.toThrow();
  });
  it.each(['', RICH_DESCRIPTION_PREFIX])('extracts readable summaries from current and legacy HTML (%s)', prefix => {
    const html = '<p><strong>Revisão</strong> &amp; <b>manutenção</b> — ação &eacute; confirmada.</p><p>Garantia<br>incluída.</p><ul><li>Livro</li><li>2 chaves</li></ul><ol><li>Inspeção</li></ol>';
    expect(descriptionText(prefix + html).replace(/\s+/g, ' ')).toBe('Revisão & manutenção — ação é confirmada. Garantia incluída. Livro 2 chaves Inspeção');
    expect(descriptionHtml(prefix + html)).toContain('<strong>manutenção</strong>');
  });
  it.each(['', RICH_DESCRIPTION_PREFIX])('removes executable markup while extracting text (%s)', prefix => {
    const html = '<p onclick="alert(1)">Seguro<img src=x onerror=alert(1)></p><script>alert(1)</script><svg onload="alert(2)"><text>perigoso</text></svg><a href="javascript:alert(3)">Ligação</a>';
    expect(descriptionText(prefix + html)).toBe('Seguro\nLigação');
    expect(descriptionText(prefix + '<p>&lt;img src=x onerror=alert(1)&gt;</p>')).toBe('<img src=x onerror=alert(1)>');
  });
  it('preserves literal plain text and handles empty descriptions without invented content', () => {
    expect(descriptionText('  Histórico < 3 anos & manutenção.\n\nPreço > 0.  ')).toBe('Histórico < 3 anos & manutenção.\n\nPreço > 0.');
    for (const input of [null, undefined, '', '  ', '<p><br></p>', RICH_DESCRIPTION_PREFIX + '<ul><li><br></li></ul>']) expect(descriptionText(input)).toBe('');
  });
  it.each(['', RICH_DESCRIPTION_PREFIX])('keeps only discreet formatting in previews (%s)', prefix => {
    const source = '<h3 style="color:red">Título</h3><p class="loud" onclick="evil()"><strong>Revisão</strong> &amp; <b>manutenção</b><br><em>confirmada</em> <a href="https://example.com">Detalhes</a></p><ul><li>Livro</li></ul><ol><li>2 chaves</li></ol><img src=x onerror="evil()"><script>evil()</script><style>p{color:red}</style><iframe src="https://evil.test"></iframe>';
    expect(descriptionPreviewHtml(prefix + source)).toBe('<p>Título</p><p><strong>Revisão</strong> &amp; <strong>manutenção</strong><br><em>confirmada</em> Detalhes</p><ul><li>Livro</li></ul><ol><li>2 chaves</li></ol>');
    expect(descriptionHtml(prefix + source)).toContain('href="https://example.com/"');
  });
  it('escapes literal preview text, does not decode executable text into elements and handles empty HTML', () => {
    expect(descriptionPreviewHtml('Histórico < 3 anos & revisão.')).toBe('<p>Histórico &lt; 3 anos &amp; revisão.</p>');
    expect(descriptionPreviewHtml('Fonte: https://example.com/viatura')).toBe('<p>Fonte: https://example.com/viatura</p>');
    expect(descriptionPreviewHtml('<p>&lt;img src=x onerror=alert(1)&gt;</p>')).toBe('<p>&lt;img src=x onerror=alert(1)&gt;</p>');
    for (const source of [null, undefined, '', '<p><br></p>', RICH_DESCRIPTION_PREFIX + '<script>evil()</script>']) expect(descriptionPreviewHtml(source)).toBe('');
  });
});

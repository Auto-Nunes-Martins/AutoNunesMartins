import { describe, expect, it } from 'vitest';
import { descriptionHtml, descriptionText, encodeDescription, RICH_DESCRIPTION_PREFIX, safeDescriptionHref, sanitizeDescriptionHtml } from './richDescription';

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
});

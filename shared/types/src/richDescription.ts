import { parseDocument } from 'htmlparser2';

/** Explicit marker keeps existing plain-text descriptions literal, including angle brackets. */
export const RICH_DESCRIPTION_PREFIX = '<!--anm:rich-description:v1-->';
type Node = ReturnType<typeof parseDocument>['children'][number];
const allowed = new Set([
  'p',
  'br',
  'strong',
  'em',
  'u',
  's',
  'h3',
  'h4',
  'ul',
  'ol',
  'li',
  'blockquote',
  'a',
]);
const discard = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'svg',
  'math',
  'template',
  'noscript',
]);
const aliases: Record<string, string> = { b: 'strong', i: 'em', strike: 's', div: 'p' };

export function escapeDescriptionText(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  );
}

export function safeDescriptionHref(value: string): string | null {
  if (/[\u0000-\u0020\\]/.test(value)) return null;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

/** Rebuild the output from a tiny allowlist; never pass through source tags or attributes. */
export function sanitizeDescriptionHtml(source: string): string {
  function render(node: Node, depth = 0): string {
    if (depth > 40) return '';
    if (node.type === 'text') return escapeDescriptionText(node.data);
    if (
      !('name' in node) ||
      !('children' in node) ||
      !('attribs' in node) ||
      discard.has(node.name)
    )
      return '';
    const children = node.children.map((child) => render(child, depth + 1)).join('');
    const name = aliases[node.name] ?? node.name;
    if (!allowed.has(name)) return children;
    if (name === 'br') return '<br>';
    if (name === 'a') {
      const href = safeDescriptionHref(node.attribs.href ?? '');
      return href
        ? `<a href="${escapeDescriptionText(href)}" target="_blank" rel="noopener noreferrer">${children}</a>`
        : children;
    }
    return `<${name}>${children}</${name}>`;
  }
  return parseDocument(source, { decodeEntities: true })
    .children.map((node) => render(node))
    .join('');
}

function hasDescriptionMarkup(value: string): boolean {
  return /<\/?(?:p|br|strong|b|em|i|u|s|h3|h4|ul|ol|li|blockquote|a)(?:\s|\/?>)/i.test(value);
}

export function descriptionHtml(value: string | null | undefined): string {
  if (!value) return '';
  if (value.startsWith(RICH_DESCRIPTION_PREFIX))
    return sanitizeDescriptionHtml(value.slice(RICH_DESCRIPTION_PREFIX.length));
  if (hasDescriptionMarkup(value))
    return sanitizeDescriptionHtml(value);
  function linkText(text: string): string {
    let result = '',
      offset = 0;
    for (const match of text.matchAll(/https?:\/\/[^\s<>]+/g)) {
      const source = match[0].replace(/[.,;!?]+$/, '');
      const href = safeDescriptionHref(source);
      result += escapeDescriptionText(text.slice(offset, match.index));
      result += href
        ? `<a href="${escapeDescriptionText(href)}" target="_blank" rel="noopener noreferrer">${escapeDescriptionText(source)}</a>`
        : escapeDescriptionText(source);
      offset = match.index! + source.length;
    }
    return result + escapeDescriptionText(text.slice(offset));
  }
  return value
    .split(/\n\s*\n/)
    .map((paragraph) => `<p>${linkText(paragraph).replace(/\r?\n/g, '<br>')}</p>`)
    .join('');
}

export function descriptionText(value: string | null | undefined): string {
  if (!value) return '';
  if (!value.startsWith(RICH_DESCRIPTION_PREFIX) && !hasDescriptionMarkup(value)) return value.trim();
  function text(node: Node): string {
    if (node.type === 'text') return node.data;
    if (!('children' in node)) return '';
    return (
      node.children.map(text).join('') +
      ('name' in node && ['p', 'br', 'li', 'h3', 'h4', 'blockquote'].includes(node.name)
        ? '\n'
        : '')
    );
  }
  return parseDocument(descriptionHtml(value)).children.map(text).join('').trim();
}

/** Compact summaries keep basic structure, never links, headings, styles or attributes. */
export function descriptionPreviewHtml(value: string | null | undefined): string {
  if (!descriptionText(value)) return '';
  const previewTags = new Set(['p', 'br', 'strong', 'em', 'ul', 'ol', 'li']);
  function render(node: Node): string {
    if (node.type === 'text') return escapeDescriptionText(node.data);
    if (!('children' in node) || !('name' in node)) return '';
    const children = node.children.map(render).join('');
    const name = ['h3', 'h4', 'blockquote'].includes(node.name) ? 'p' : node.name;
    if (!previewTags.has(name)) return children;
    return name === 'br' ? '<br>' : `<${name}>${children}</${name}>`;
  }
  return parseDocument(descriptionHtml(value)).children.map(render).join('');
}

export function encodeDescription(html: string): string {
  const value = RICH_DESCRIPTION_PREFIX + sanitizeDescriptionHtml(html);
  return descriptionText(value) ? value : '';
}

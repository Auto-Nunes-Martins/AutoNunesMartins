import { expect, it } from 'vitest';
import { complaintsPortal, legalValue, officialLegalUrl, publicLegalLinks } from './publicLegal';
import readiness from './publicationReadiness.json';
import { readFileSync } from 'node:fs';
import { FAVORITES_KEY } from './favorites';
import { COMPARISON_KEY } from './comparison';
import { THEME_KEY } from './publicTheme';

it('never turns pending official data into an invented entity, membership or URL',()=>{
  for(const group of [readiness.operator,readiness.privacy,readiness.disputes,readiness.complaints])for(const field of group)if(field.value===null)expect(legalValue(field.id)).toBeNull();
  expect(legalValue('not-a-field')).toBeNull();
  if(legalValue('complaintsUrl')===null)expect(complaintsPortal).toBe('https://www.livroreclamacoes.pt/');
  expect(readiness.checks.find(check=>check.id==='storageConsent')?.status).toBe('pending');
});
it.each([null,'','javascript:alert(1)','data:text/html,wrong','http://example.test','//example.test','/pending','https://user:password@example.test'])('does not publish unsafe/placeholder official links: %s',value=>{
  expect(officialLegalUrl(value)).toBeNull();
});
it('accepts explicit HTTPS official links and provides unique local destinations',()=>{
  expect(officialLegalUrl('https://example.test/entidade')).toBe('https://example.test/entidade');
  expect(new Set(publicLegalLinks.map(item=>item.href)).size).toBe(publicLegalLinks.length);
  expect(publicLegalLinks.every(item=>/^\/[a-z-]+$/.test(item.href))).toBe(true);
});
it('keeps the published storage inventory aligned with the keys actually used by the preference stores',()=>{
  const page=readFileSync(new URL('./components/PrivacyPreferences.svelte',import.meta.url),'utf8');
  for(const key of [FAVORITES_KEY,COMPARISON_KEY,THEME_KEY])expect(page).toContain(key);
  const startup=readFileSync(new URL('../../assets/orbit-startup.js',import.meta.url),'utf8');
  const sessionKey=startup.match(/sessionStorage\.setItem\(\s*'([^']+)'/)!;
  expect(sessionKey).not.toBeNull();expect(page).toContain(sessionKey[1]);
});

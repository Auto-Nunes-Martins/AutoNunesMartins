import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

it('escapes contact previews, preserves Portuguese text and distinguishes individual read states', () => {
  const componentPath = fileURLToPath(new URL('./ContactNotificationList.svelte', import.meta.url));
  // Use native Node module loading for the SSR compiler, independent of the TS-only Vitest config.
  const script = `
    import { compile } from 'svelte/compiler';
    import { render } from 'svelte/server';
    import { readFileSync } from 'node:fs';
    import { createRequire } from 'node:module';
    import { pathToFileURL } from 'node:url';
    const require = createRequire(process.cwd() + '/package.json');
    const source = readFileSync(${JSON.stringify(componentPath)}, 'utf8')
      .replace("import { Check, Mail } from 'lucide-svelte';", 'const Check = () => {}; const Mail = () => {};');
    const built = compile(source, { generate: 'server', filename: 'ContactNotificationList.svelte' });
    const code = built.js.code.replaceAll("'svelte/internal/server'", JSON.stringify(pathToFileURL(require.resolve('svelte/internal/server')).href));
    const component = await import('data:text/javascript,' + encodeURIComponent(code));
    const result = render(component.default, { props: {
      items: [
        { id: 'contact:one', name: '<script>alert(1)</script>', subject: 'Conceição & revisão ç', createdAt: '2026-10-27T12:00:00Z', read: false },
        { id: 'contact:two', name: 'João', subject: 'Visita', createdAt: '2026-10-27T12:01:00Z', read: true },
      ], onRead: () => {},
    } });
    process.stdout.write(result.body);
  `;
  const html = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    encoding: 'utf8',
  });
  expect(html).not.toContain('<script>alert(1)</script>');
  expect(html).toContain('&lt;script>');
  expect(html).toContain('Conceição &amp; revisão ç');
  expect(html).toContain('Não lida');
  expect(html).toContain('Lida por si');
  expect(html).toContain('2026-10-27T12:00:00Z');
});

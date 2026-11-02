// Review aid for this local batch. Reads tracked baseline/current source; writes nothing.
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { compile } from 'svelte/compiler';
import prettier from 'prettier';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(
  await readFile(join(root, 'docs/global-code-review-2026-11-01-files.json'), 'utf8'),
);
const functional = new Set(manifest.functional);
const git = (args) =>
  execFileSync('git', ['-c', 'core.safecrlf=false', ...args], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 8 * 1024 * 1024,
  });

function syntax(source, filename = 'source.ts') {
  const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);
  function visit(node) {
    if (ts.isParenthesizedExpression(node) || ts.isParenthesizedTypeNode(node))
      return visit(node.expression ?? node.type);
    const value = { kind: node.kind };
    // Prettier may remove optional quotes from object keys, including Unicode identifiers.
    const property =
      ts.isPropertyAssignment(node) &&
      (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name));
    if (property) value.propertyName = node.name.text;
    if (!ts.isSourceFile(node) && typeof node.text === 'string') value.text = node.text;
    // Untagged templates expose their cooked value (including LF/CRLF normalization).
    // Tagged templates also expose raw strings, so retain those bytes in the comparison.
    let template = node;
    if (node.kind === ts.SyntaxKind.TemplateHead) template = node.parent;
    else if (node.kind === ts.SyntaxKind.TemplateMiddle || node.kind === ts.SyntaxKind.TemplateTail)
      template = node.parent?.parent;
    if (
      typeof node.rawText === 'string' &&
      template?.parent &&
      ts.isTaggedTemplateExpression(template.parent)
    )
      value.rawText = node.rawText;
    if (ts.isVariableDeclarationList(node))
      value.declarationKind = node.flags & (ts.NodeFlags.Let | ts.NodeFlags.Const);
    const children = [];
    ts.forEachChild(node, (child) => {
      if (!property || child !== node.name) children.push(visit(child));
    });
    if (children.length) value.children = children;
    return value;
  }
  return JSON.stringify(visit(ast));
}

function directives(source) {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    ts.LanguageVariant.Standard,
    source,
  );
  const result = [];
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    if (
      token === ts.SyntaxKind.SingleLineCommentTrivia ||
      token === ts.SyntaxKind.MultiLineCommentTrivia
    ) {
      const text = scanner.getTokenText();
      if (/@ts-|eslint-|prettier-ignore|istanbul ignore|c8 ignore/.test(text))
        result.push(text.trim());
    }
  }
  return JSON.stringify(result);
}

const canonicalCss = async (css) => (css ? prettier.format(css, { parser: 'css' }) : '');
const checked = { script: 0, svelte: 0, css: 0 };
const failures = [];
for (const file of git(['diff', '--name-only']).trim().split('\n').filter(Boolean)) {
  if (functional.has(file) || !/\.(?:[cm]?[jt]s|svelte|css)$/.test(file)) continue;
  const before = git(['show', `${manifest.baseline}:${file}`]);
  const after = await readFile(join(root, file), 'utf8');
  try {
    if (file.endsWith('.svelte')) {
      for (const generate of ['client', 'server']) {
        const options = {
          filename: file,
          generate,
          dev: false,
          css: 'external',
          cssHash: () => 'review-equivalent',
        };
        const oldBuild = compile(before, options),
          newBuild = compile(after, options);
        if (syntax(oldBuild.js.code, 'compiled.js') !== syntax(newBuild.js.code, 'compiled.js'))
          throw new Error(`${generate} JavaScript differs`);
        if ((await canonicalCss(oldBuild.css?.code)) !== (await canonicalCss(newBuild.css?.code)))
          throw new Error(`${generate} CSS differs`);
        const warnings = (build) =>
          JSON.stringify(build.warnings.map(({ code, message }) => ({ code, message })));
        if (warnings(oldBuild) !== warnings(newBuild))
          throw new Error(`${generate} warnings differ`);
      }
      checked.svelte++;
    } else if (file.endsWith('.css')) {
      if ((await canonicalCss(before)) !== (await canonicalCss(after)))
        throw new Error('CSS differs');
      checked.css++;
    } else {
      if (syntax(before, file) !== syntax(after, file)) throw new Error('Syntax differs');
      if (directives(before) !== directives(after))
        throw new Error('Compiler/lint directives differ');
      checked.script++;
    }
  } catch (error) {
    failures.push({ file, reason: error.message });
  }
}
console.log(
  JSON.stringify(
    {
      baseline: manifest.baseline,
      checked,
      failureCount: failures.length,
      failures: failures.slice(0, 20),
    },
    null,
    2,
  ),
);
if (failures.length) process.exitCode = 1;

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';

const traverse = traverseModule.default;
const dashboardRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(dashboardRoot, 'src');

const browserGlobals = [
  'AbortController',
  'AbortSignal',
  'Array',
  'ArrayBuffer',
  'Blob',
  'Boolean',
  'BroadcastChannel',
  'CSS',
  'CustomEvent',
  'DataTransfer',
  'Date',
  'Error',
  'Event',
  'File',
  'FileReader',
  'FormData',
  'HTMLElement',
  'Image',
  'Infinity',
  'Intl',
  'JSON',
  'Map',
  'Math',
  'MutationObserver',
  'NaN',
  'Notification',
  'Number',
  'Object',
  'Promise',
  'Proxy',
  'Range',
  'RegExp',
  'ResizeObserver',
  'Set',
  'SpeechSynthesisUtterance',
  'String',
  'Symbol',
  'URL',
  'URLSearchParams',
  'Uint8Array',
  'WeakMap',
  'WeakSet',
  'alert',
  'atob',
  'btoa',
  'cancelAnimationFrame',
  'clearInterval',
  'clearTimeout',
  'confirm',
  'console',
  'crypto',
  'decodeURIComponent',
  'document',
  'encodeURIComponent',
  'fetch',
  'history',
  'isFinite',
  'isNaN',
  'localStorage',
  'location',
  'navigator',
  'parseFloat',
  'parseInt',
  'performance',
  'queueMicrotask',
  'requestAnimationFrame',
  'self',
  'sessionStorage',
  'setInterval',
  'setTimeout',
  'structuredClone',
  'undefined',
  'window',
];

const allowedGlobals = new Set([
  ...browserGlobals,
  'process',
]);

const sourceExtensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);

function sourceFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...sourceFiles(fullPath));
    } else if (sourceExtensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function jsxRootName(node) {
  if (!node) return null;
  if (node.type === 'JSXIdentifier') return node.name;
  if (node.type === 'JSXMemberExpression') return jsxRootName(node.object);
  if (node.type === 'JSXNamespacedName') return node.namespace?.name || null;
  return null;
}

function parseSource(filePath) {
  return parse(fs.readFileSync(filePath, 'utf8'), {
    sourceType: 'module',
    errorRecovery: true,
    plugins: [
      'jsx',
      'typescript',
      'importMeta',
      'dynamicImport',
      'topLevelAwait',
    ],
  });
}

const findings = [];

for (const filePath of sourceFiles(sourceRoot)) {
  let ast;

  try {
    ast = parseSource(filePath);
  } catch (error) {
    findings.push({
      filePath,
      line: error.loc?.line || 0,
      column: error.loc?.column || 0,
      name: 'parse error',
      detail: error.message,
    });
    continue;
  }

  const addFinding = (name, loc, detail = '') => {
    if (allowedGlobals.has(name)) return;
    findings.push({
      filePath,
      line: loc?.line || 0,
      column: loc?.column || 0,
      name,
      detail,
    });
  };

  traverse(ast, {
    Identifier(pathRef) {
      const name = pathRef.node.name;

      if (!pathRef.isReferencedIdentifier()) return;
      if (pathRef.scope.hasBinding(name)) return;

      addFinding(name, pathRef.node.loc?.start);
    },

    JSXOpeningElement(pathRef) {
      const name = jsxRootName(pathRef.node.name);

      if (!name || !/^[A-Z]/.test(name)) return;
      if (pathRef.scope.hasBinding(name)) return;

      addFinding(name, pathRef.node.loc?.start, 'JSX component');
    },
  });
}

const uniqueFindings = [
  ...new Map(
    findings.map((finding) => [
      [
        path.relative(dashboardRoot, finding.filePath),
        finding.line,
        finding.column,
        finding.name,
        finding.detail,
      ].join(':'),
      finding,
    ]),
  ).values(),
].sort((a, b) => (
  a.filePath.localeCompare(b.filePath) ||
  a.line - b.line ||
  a.column - b.column ||
  a.name.localeCompare(b.name)
));

if (uniqueFindings.length > 0) {
  console.error('Unbound identifiers found in dashboard/src:');
  for (const finding of uniqueFindings) {
    const file = path.relative(dashboardRoot, finding.filePath);
    const location = finding.line ? `${file}:${finding.line}:${finding.column + 1}` : file;
    const detail = finding.detail ? ` (${finding.detail})` : '';
    console.error(`- ${location} ${finding.name}${detail}`);
  }
  process.exit(1);
}

console.log('No unbound identifiers found in dashboard/src.');

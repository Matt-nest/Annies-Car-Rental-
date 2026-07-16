#!/usr/bin/env node

import { execFileSync } from 'node:child_process';

const CUSTOMER_SITE_PATHS = [
  'src/',
  'public/',
  'index.html',
  'vite.config.js',
  'vite.config.mjs',
  'vite.config.ts',
  'tsconfig.json',
  'tsconfig.app.json',
  'tsconfig.node.json',
  'package.json',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'postcss.config.js',
  'postcss.config.cjs',
  'postcss.config.mjs',
  'tailwind.config.js',
  'tailwind.config.cjs',
  'tailwind.config.mjs',
  'tailwind.config.ts',
  'vercel.json',
];

function cleanSha(value) {
  const sha = String(value || '').trim();
  return sha && !/^0+$/.test(sha) ? sha : null;
}

function gitChangedFiles(from, to) {
  const output = execFileSync('git', ['diff', '--name-only', from, to], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function findChangedFiles() {
  const currentSha = cleanSha(process.env.VERCEL_GIT_COMMIT_SHA) || 'HEAD';
  const previousSha = cleanSha(process.env.VERCEL_GIT_PREVIOUS_SHA);
  const ranges = [];

  if (previousSha) {
    ranges.push([previousSha, currentSha]);
  }

  ranges.push(['HEAD^', 'HEAD']);

  for (const [from, to] of ranges) {
    try {
      return gitChangedFiles(from, to);
    } catch {
      // Fall through to the next range.
    }
  }

  console.log('Could not determine changed files. Continuing customer site build.');
  process.exit(1);
}

function isCustomerSitePath(filePath) {
  return CUSTOMER_SITE_PATHS.some((path) => filePath === path || filePath.startsWith(path));
}

const changedFiles = findChangedFiles();
const customerChanges = changedFiles.filter(isCustomerSitePath);

if (customerChanges.length > 0) {
  console.log('Customer site files changed. Continuing customer site build:');
  console.log(customerChanges.join('\n'));
  process.exit(1);
}

console.log(`No customer site changes in ${changedFiles.length} changed file(s). Ignoring customer site build.`);
process.exit(0);

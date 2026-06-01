/**
 * Interpolator tests — Phase 2 audit F-19.
 *
 * Old loop used `pattern.test(result)` with the `/g` flag — JS spec advances
 * `lastIndex` between `.test()` calls on the same regex, which can return
 * false when matches still exist. New loop runs until output stabilizes
 * (fixed-point), supporting arbitrarily deep nesting.
 *
 * Run: node --test tests/interpolator.test.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpolateTemplate } from '../services/notifyService.js';

test('flat keys: simple {{key}} replacement', () => {
  const out = interpolateTemplate('Hello {{name}}', { name: 'Matt' });
  assert.equal(out, 'Hello Matt');
});

test('missing key falls through as literal {{key}} (intentional fallback behavior)', () => {
  const out = interpolateTemplate('Hello {{missing}}', { name: 'Matt' });
  assert.equal(out, 'Hello {{missing}}');
});

test('{{#if}} truthy renders block', () => {
  const out = interpolateTemplate('A{{#if x}}B{{/if}}C', { x: 'yes' });
  assert.equal(out, 'ABC');
});

test('{{#if}} empty string is falsy → block stripped', () => {
  const out = interpolateTemplate('A{{#if x}}B{{/if}}C', { x: '' });
  assert.equal(out, 'AC');
});

test('{{#if}} undefined is falsy → block stripped', () => {
  const out = interpolateTemplate('A{{#if x}}B{{/if}}C', {});
  assert.equal(out, 'AC');
});

test('nested {{#if}} 3 levels deep — all truthy', () => {
  const tmpl = '{{#if a}}A1{{#if b}}B1{{#if c}}C{{/if}}B2{{/if}}A2{{/if}}';
  const out = interpolateTemplate(tmpl, { a: 1, b: 1, c: 1 });
  assert.equal(out, 'A1B1CB2A2');
});

test('nested {{#if}} 3 levels deep — middle falsy strips inner', () => {
  // Note: existing truthiness rule treats 0/false as truthy. Only
  // undefined/null/empty-string/'[]'/'""' are falsy. Use '' for the falsy.
  const tmpl = '{{#if a}}A1{{#if b}}B1{{#if c}}C{{/if}}B2{{/if}}A2{{/if}}';
  const out = interpolateTemplate(tmpl, { a: 1, b: '', c: 1 });
  assert.equal(out, 'A1A2');
});

test('deep nesting (8 levels) — fixed-point loop converges, no truncation', () => {
  // Mimics what an admin-authored template might do — concatenate per-level
  // markers so we can verify each level resolved.
  let tmpl = '';
  let expected = '';
  for (let i = 0; i < 8; i++) tmpl += `{{#if k${i}}}L${i}`;
  for (let i = 7; i >= 0; i--) tmpl += `{{/if}}`;
  for (let i = 0; i < 8; i++) expected += `L${i}`;

  const fields = {};
  for (let i = 0; i < 8; i++) fields[`k${i}`] = 'truthy';

  const out = interpolateTemplate(tmpl, fields);
  assert.equal(out, expected);
});

test('mixed {{key}} and {{#if}} with merge-field replacement', () => {
  const tmpl = '{{first}} {{#if has_last}}{{last}}{{/if}}!';
  assert.equal(interpolateTemplate(tmpl, { first: 'Matt', last: 'N', has_last: 'yes' }), 'Matt N!');
  // Empty string is the falsy case (not boolean false — see truthiness rule)
  assert.equal(interpolateTemplate(tmpl, { first: 'Matt', last: 'N', has_last: '' }), 'Matt !');
});

test('isHtml=true HTML-escapes merge fields, but not URLs/links', () => {
  const out = interpolateTemplate('Hi {{name}}, visit {{portal_link}}', {
    name: '<script>alert(1)</script>',
    portal_link: 'https://example.com',
  }, true);
  assert.match(out, /&lt;script&gt;/);   // name is escaped
  assert.match(out, /https:\/\/example\.com/); // URL is not escaped (whitelisted)
});

test('isHtml=false leaves merge fields unescaped (SMS/subject lines)', () => {
  const out = interpolateTemplate('Hi {{name}}', { name: 'O\'Brien' }, false);
  assert.equal(out, "Hi O'Brien");
});

test('fixed-point loop terminates on input that produces no replacement', () => {
  // Edge case: template with malformed {{#if}} that never matches
  const tmpl = '{{#if no_close';
  const out = interpolateTemplate(tmpl, { no_close: true });
  assert.equal(out, '{{#if no_close');
});

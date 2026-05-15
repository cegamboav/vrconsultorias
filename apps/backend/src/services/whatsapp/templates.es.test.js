/**
 * templates.es.test.js — Unit tests for the WhatsApp template catalog.
 *
 * Uses Node's built-in test runner (node:test) and strict assertions.
 * No external dependencies required.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getTemplate, getTemplateOrThrow, interpolate } from './templates.es.js';

// ── getTemplate ──────────────────────────────────────────────────────────────

test('getTemplate returns correct template for FOLLOW_UP + NO_RESPONSE', () => {
  const tpl = getTemplate('FOLLOW_UP', 'NO_RESPONSE');
  assert.ok(tpl !== null, 'Expected a template object, got null');
  assert.equal(tpl.templateKey, 'followup_no_response');
  assert.ok(tpl.text.includes('{{fullName}}'), 'Template text must contain {{fullName}}');
  assert.ok(tpl.text.includes('{{calendlyUrl}}'), 'Template text must contain {{calendlyUrl}}');
});

test('getTemplate returns null for unknown status', () => {
  const tpl = getTemplate('UNKNOWN_STATUS', 'NO_RESPONSE');
  assert.equal(tpl, null);
});

test('getTemplate returns null for unknown reason with valid status', () => {
  const tpl = getTemplate('FOLLOW_UP', 'NONEXISTENT_REASON');
  assert.equal(tpl, null);
});

test('getTemplate returns manual_intro template when status === manual_intro', () => {
  const tpl = getTemplate('manual_intro');
  assert.ok(tpl !== null, 'Expected a template object for manual_intro');
  assert.equal(tpl.templateKey, 'manual_intro');
  assert.ok(tpl.text.includes('{{fullName}}'));
  assert.ok(tpl.text.includes('{{ownerName}}'));
});

test('getTemplate returns manual_intro even when followUpReason is provided', () => {
  // The manual_intro path ignores followUpReason by design
  const tpl = getTemplate('manual_intro', 'NO_RESPONSE');
  assert.ok(tpl !== null);
  assert.equal(tpl.templateKey, 'manual_intro');
});

// ── getTemplateOrThrow ───────────────────────────────────────────────────────

test('getTemplateOrThrow throws for unknown status/reason', () => {
  assert.throws(
    () => getTemplateOrThrow('GHOST_STATUS', 'GHOST_REASON'),
    (err) => {
      assert.ok(err instanceof Error);
      assert.ok(err.message.includes('GHOST_STATUS'), 'Error message should contain the status');
      return true;
    },
  );
});

test('getTemplateOrThrow returns template for valid key FOLLOW_UP + CALL_LATER', () => {
  const tpl = getTemplateOrThrow('FOLLOW_UP', 'CALL_LATER');
  assert.ok(tpl !== null);
  assert.equal(tpl.templateKey, 'followup_call_later');
});

// ── interpolate ──────────────────────────────────────────────────────────────

test('interpolate replaces {{fullName}}, {{ownerName}}, {{calendlyUrl}}', () => {
  const text = 'Hola {{fullName}}, le escribe {{ownerName}}. Agende en {{calendlyUrl}}.';
  const result = interpolate(text, {
    fullName: 'María',
    ownerName: 'Juan',
    calendlyUrl: 'https://calendly.com/juan',
  });
  assert.equal(result, 'Hola María, le escribe Juan. Agende en https://calendly.com/juan.');
});

test('interpolate replaces missing variables with empty string', () => {
  const text = 'Hola {{fullName}}, escribe {{ownerName}} desde {{calendlyUrl}}.';
  // Pass no variables — all should collapse to ''
  const result = interpolate(text, {});
  assert.equal(result, 'Hola , escribe  desde .');
});

test('interpolate with undefined variables argument defaults all to empty string', () => {
  const text = '{{fullName}} {{ownerName}} {{calendlyUrl}}';
  const result = interpolate(text, undefined);
  assert.equal(result, '  ');
});

test('interpolate replaces multiple occurrences of the same placeholder', () => {
  const text = '{{fullName}} y luego {{fullName}} otra vez.';
  const result = interpolate(text, { fullName: 'Ana' });
  assert.equal(result, 'Ana y luego Ana otra vez.');
});

// ── All 6 FOLLOW_UP variants return a template ───────────────────────────────

const FOLLOW_UP_REASONS = ['NO_RESPONSE', 'CALL_LATER', 'THINKING', 'NO_MONEY', 'BUSY', 'OTHER'];

for (const reason of FOLLOW_UP_REASONS) {
  test(`getTemplate returns a template for FOLLOW_UP + ${reason}`, () => {
    const tpl = getTemplate('FOLLOW_UP', reason);
    assert.ok(tpl !== null, `Expected template for FOLLOW_UP:${reason}, got null`);
    assert.ok(typeof tpl.templateKey === 'string' && tpl.templateKey.length > 0);
    assert.ok(typeof tpl.text === 'string' && tpl.text.length > 0);
  });
}

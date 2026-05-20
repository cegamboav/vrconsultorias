/**
 * templates.es.test.js — Unit tests for the WhatsApp template catalog.
 *
 * Uses Node's built-in test runner (node:test) and strict assertions.
 * No external dependencies required.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getTemplate, getTemplateOrThrow, getTemplateByKey, interpolate } from './templates.es.js';

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
    assert.ok(Array.isArray(tpl.variables), 'variables must be an array');
  });
}

// ── variables field: each template declares the right vars in the right order ─

test('followup_no_response declares [fullName, calendlyUrl] — order matches text', () => {
  const tpl = getTemplate('FOLLOW_UP', 'NO_RESPONSE');
  assert.deepEqual(tpl.variables, ['fullName', 'calendlyUrl']);
  // Sanity: order in `variables` must match left-to-right order in `text`
  const fullNamePos = tpl.text.indexOf('{{fullName}}');
  const calendlyPos = tpl.text.indexOf('{{calendlyUrl}}');
  assert.ok(fullNamePos !== -1 && calendlyPos !== -1);
  assert.ok(fullNamePos < calendlyPos, '{{fullName}} must come before {{calendlyUrl}} in the text');
});

test('followup_call_later declares [fullName, calendlyUrl]', () => {
  assert.deepEqual(getTemplate('FOLLOW_UP', 'CALL_LATER').variables, ['fullName', 'calendlyUrl']);
});

test('followup_generic declares only [fullName] for all 4 reasons (THINKING/NO_MONEY/BUSY/OTHER)', () => {
  for (const reason of ['THINKING', 'NO_MONEY', 'BUSY', 'OTHER']) {
    const tpl = getTemplate('FOLLOW_UP', reason);
    assert.equal(tpl.templateKey, 'followup_generic');
    assert.deepEqual(tpl.variables, ['fullName'], `FOLLOW_UP:${reason} variables mismatch`);
  }
});

test('manual_intro declares [fullName, ownerName] — order matches text', () => {
  const tpl = getTemplate('manual_intro');
  assert.deepEqual(tpl.variables, ['fullName', 'ownerName']);
  const fullNamePos = tpl.text.indexOf('{{fullName}}');
  const ownerNamePos = tpl.text.indexOf('{{ownerName}}');
  assert.ok(fullNamePos < ownerNamePos, '{{fullName}} must come before {{ownerName}}');
});

// ── getTemplateByKey ─────────────────────────────────────────────────────────

test('getTemplateByKey returns followup_no_response definition', () => {
  const tpl = getTemplateByKey('followup_no_response');
  assert.ok(tpl);
  assert.equal(tpl.templateKey, 'followup_no_response');
  assert.deepEqual(tpl.variables, ['fullName', 'calendlyUrl']);
});

test('getTemplateByKey returns followup_generic with 1 variable regardless of which reason mapped to it', () => {
  const tpl = getTemplateByKey('followup_generic');
  assert.ok(tpl);
  assert.equal(tpl.templateKey, 'followup_generic');
  assert.deepEqual(tpl.variables, ['fullName']);
});

test('getTemplateByKey returns manual_intro definition', () => {
  const tpl = getTemplateByKey('manual_intro');
  assert.ok(tpl);
  assert.deepEqual(tpl.variables, ['fullName', 'ownerName']);
});

test('getTemplateByKey returns null for unknown templateKey', () => {
  assert.equal(getTemplateByKey('does_not_exist'), null);
});

// ── interpolate: generic placeholder names ───────────────────────────────────

test('interpolate replaces arbitrary placeholder names beyond the original 3', () => {
  // The refactor made interpolate generic so future templates can introduce new variables
  const text = 'Saldo: {{amount}} colones para {{customerName}}.';
  const result = interpolate(text, { amount: '50000', customerName: 'Lucía' });
  assert.equal(result, 'Saldo: 50000 colones para Lucía.');
});

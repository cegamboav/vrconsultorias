/**
 * phone.test.js — Unit tests for the E.164 phone number normalizer.
 *
 * Uses Node's built-in test runner (node:test) and strict assertions.
 * No external dependencies required.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toE164 } from './phone.js';

// ── Already E.164 ─────────────────────────────────────────────────────────────

test('toE164 leaves an already-E.164 number unchanged', () => {
  assert.equal(toE164('+50688881234'), '+50688881234');
});

test('toE164 leaves a non-CR E.164 number unchanged', () => {
  assert.equal(toE164('+14155551234'), '+14155551234');
});

// ── Local CR numbers (8 digits, no country code) ─────────────────────────────

test('toE164 prepends +506 to a bare 8-digit CR number', () => {
  assert.equal(toE164('88881234'), '+50688881234');
});

test('toE164 strips dash and prepends +506 to a formatted CR number', () => {
  assert.equal(toE164('8888-1234'), '+50688881234');
});

// ── With country code, no + ────────────────────────────────────────────────────

test('toE164 adds + when number starts with country code 506 but no +', () => {
  assert.equal(toE164('50688881234'), '+50688881234');
});

// ── International 00 prefix ───────────────────────────────────────────────────

test('toE164 converts 00 international prefix to +', () => {
  assert.equal(toE164('0050688881234'), '+50688881234');
});

// ── Different default country code ───────────────────────────────────────────

test('toE164 uses a custom default country code (+1) for a bare number', () => {
  assert.equal(toE164('41555551234', '1'), '+141555551234');
});

test('toE164 does not double-prefix when number already has the custom country code', () => {
  // '141555551234' starts with '1' (the custom code) so it just gets + prepended
  assert.equal(toE164('141555551234', '1'), '+141555551234');
});

// ── Whitespace and formatting characters ──────────────────────────────────────

test('toE164 strips spaces from a formatted number', () => {
  assert.equal(toE164('8888 1234'), '+50688881234');
});

test('toE164 strips parentheses and dots', () => {
  // Edge: (8888).1234 → '88881234' → '+50688881234'
  assert.equal(toE164('(8888).1234'), '+50688881234');
});

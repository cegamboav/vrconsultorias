/**
 * whatsapp-providers.test.js — Unit tests for WhatsApp provider implementations.
 *
 * Uses Node's built-in test runner (node:test). No external test deps.
 * MetaCloudWhatsAppProvider tests mock globalThis.fetch to validate the request
 * payload and exercise success / 4xx / network-error paths.
 */

import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { NoopWhatsAppProvider } from './noop.provider.js';

// ── NoopWhatsAppProvider ──────────────────────────────────────────────────────

test('NoopWhatsAppProvider.sendTemplate returns DRY_RUN status', async () => {
  const provider = new NoopWhatsAppProvider();
  const result = await provider.sendTemplate({
    to: '+50688881234',
    templateKey: 'followup_no_response',
    variables: { fullName: 'María', ownerName: 'Juan', calendlyUrl: 'https://calendly.com/juan' },
    leadId: 'lead-abc',
  });
  assert.equal(result.status, 'DRY_RUN');
  assert.equal(result.providerMessageId, null);
  assert.equal(result.raw, null);
});

test('NoopWhatsAppProvider.sendTemplate returns correct shape with minimal params', async () => {
  const provider = new NoopWhatsAppProvider();
  const result = await provider.sendTemplate({ to: '+1234567890', templateKey: 'test', leadId: 42 });
  assert.ok('status' in result, 'result must have status');
  assert.ok('providerMessageId' in result, 'result must have providerMessageId');
  assert.ok('raw' in result, 'result must have raw');
  assert.equal(result.status, 'DRY_RUN');
});

test('NoopWhatsAppProvider.sendTemplate works with all FOLLOW_UP template keys', async () => {
  const provider = new NoopWhatsAppProvider();
  const keys = ['followup_no_response', 'followup_call_later', 'followup_generic', 'manual_intro'];
  for (const key of keys) {
    const result = await provider.sendTemplate({ to: '+50688881234', templateKey: key, leadId: 1 });
    assert.equal(result.status, 'DRY_RUN', `Expected DRY_RUN for key=${key}`);
  }
});

// ── MetaCloudWhatsAppProvider (real fetch, mocked) ────────────────────────────
// Mocked env so the constructor does not throw on missing real credentials.

const mockMetaEnv = {
  whatsapp: {
    token: 'test-token',
    phoneNumberId: 'test-phone-id',
    apiVersion: 'v25.0',
  },
};

mock.module('../../config/env.js', {
  namedExports: { env: mockMetaEnv },
});

const { MetaCloudWhatsAppProvider } = await import('./meta-cloud.provider.js');

test('MetaCloudWhatsAppProvider.sendTemplate posts to Meta and returns SENT on 200', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', () =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        messaging_product: 'whatsapp',
        contacts: [{ input: '50688881234', wa_id: '50688881234' }],
        messages: [{ id: 'wamid.HBgM_TEST' }],
      }),
    })
  );

  const provider = new MetaCloudWhatsAppProvider();
  const result = await provider.sendTemplate({
    to: '+50688881234',
    templateKey: 'followup_no_response',
    variables: { fullName: 'Ana', ownerName: 'Pedro', calendlyUrl: 'https://calendly.com/test' },
    leadId: 'lead-xyz',
  });

  assert.equal(result.status, 'SENT');
  assert.equal(result.providerMessageId, 'wamid.HBgM_TEST');
  assert.ok(result.raw);

  assert.equal(fetchMock.mock.callCount(), 1);
  const [url, init] = fetchMock.mock.calls[0].arguments;
  assert.match(url, /graph\.facebook\.com\/v25\.0\/test-phone-id\/messages$/);
  assert.equal(init.method, 'POST');
  assert.equal(init.headers.Authorization, 'Bearer test-token');
  assert.equal(init.headers['Content-Type'], 'application/json');

  const body = JSON.parse(init.body);
  assert.equal(body.messaging_product, 'whatsapp');
  assert.equal(body.to, '50688881234', 'leading "+" must be stripped');
  assert.equal(body.type, 'template');
  assert.equal(body.template.name, 'followup_no_response');
  assert.equal(body.template.language.code, 'es');
  const params = body.template.components[0].parameters;
  assert.equal(params[0].text, 'Ana');
  assert.equal(params[1].text, 'Pedro');
  assert.equal(params[2].text, 'https://calendly.com/test');
});

test('MetaCloudWhatsAppProvider.sendTemplate falls back to empty strings for missing variables', async (t) => {
  let capturedBody;
  t.mock.method(globalThis, 'fetch', (_url, init) => {
    capturedBody = JSON.parse(init.body);
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ messages: [{ id: 'wamid.x' }] }),
    });
  });

  const provider = new MetaCloudWhatsAppProvider();
  const result = await provider.sendTemplate({
    to: '+50688881234',
    templateKey: 'followup_generic',
    variables: {},
    leadId: 'lead-1',
  });

  assert.equal(result.status, 'SENT');
  const params = capturedBody.template.components[0].parameters;
  assert.equal(params[0].text, '');
  assert.equal(params[1].text, '');
  assert.equal(params[2].text, '');
});

test('MetaCloudWhatsAppProvider.sendTemplate handles undefined variables', async (t) => {
  let capturedBody;
  t.mock.method(globalThis, 'fetch', (_url, init) => {
    capturedBody = JSON.parse(init.body);
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ messages: [{ id: 'wamid.y' }] }),
    });
  });

  const provider = new MetaCloudWhatsAppProvider();
  const result = await provider.sendTemplate({
    to: '+50688881234',
    templateKey: 'manual_intro',
    variables: undefined,
    leadId: 99,
  });

  assert.equal(result.status, 'SENT');
  const params = capturedBody.template.components[0].parameters;
  assert.equal(params[0].text, '');
  assert.equal(params[1].text, '');
  assert.equal(params[2].text, '');
});

test('MetaCloudWhatsAppProvider.sendTemplate throws AppError on Meta 4xx response', async (t) => {
  t.mock.method(globalThis, 'fetch', () =>
    Promise.resolve({
      ok: false,
      status: 400,
      json: () => Promise.resolve({
        error: { code: 131030, message: 'Recipient phone number not in allowed list' },
      }),
    })
  );

  const provider = new MetaCloudWhatsAppProvider();
  await assert.rejects(
    () => provider.sendTemplate({
      to: '+50688881234',
      templateKey: 'followup_no_response',
      variables: {},
      leadId: 'lead-err',
    }),
    (err) => {
      assert.match(err.message, /131030/);
      assert.match(err.message, /not in allowed list/);
      assert.equal(err.statusCode, 400);
      return true;
    }
  );
});

test('MetaCloudWhatsAppProvider.sendTemplate throws AppError on network failure', async (t) => {
  t.mock.method(globalThis, 'fetch', () => Promise.reject(new Error('ECONNREFUSED')));

  const provider = new MetaCloudWhatsAppProvider();
  await assert.rejects(
    () => provider.sendTemplate({
      to: '+50688881234',
      templateKey: 'manual_intro',
      variables: {},
      leadId: 'lead-net',
    }),
    (err) => {
      assert.match(err.message, /unreachable/);
      assert.equal(err.statusCode, 502);
      return true;
    }
  );
});

test('MetaCloudWhatsAppProvider stores correct config from env', async () => {
  const provider = new MetaCloudWhatsAppProvider();
  assert.equal(provider.token, 'test-token');
  assert.equal(provider.phoneNumberId, 'test-phone-id');
  assert.equal(provider.apiVersion, 'v25.0');
});

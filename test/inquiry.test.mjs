import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  RECIPIENT,
  buildBrief,
  handleInquiry,
  resetRateLimits,
} from '../lib/inquiry.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = {
  RESEND_API_KEY: 're_test_key_not_real',
  INQUIRY_FROM: 'Made by Lumi <inquiries@madebylumi.com>',
};

const valid = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  message: 'Make it easier for customers to book a session.',
  need: 'A new or better website',
  timing: 'Just exploring',
  hp_field: '',
};

function post(body, { ip = '203.0.113.10', origin, raw } = {}) {
  const headers = { 'content-type': 'application/json', 'x-forwarded-for': ip };
  if (origin) headers.origin = origin;
  return new Request('https://madebylumi.com/api/inquiry', {
    method: 'POST',
    headers,
    body: raw ?? JSON.stringify(body),
  });
}

async function send(body, options = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    const status = options.resendStatus ?? 200;
    const payload = options.resendBody ?? { id: 'email_test' };
    if (options.resendThrow) throw new Error('network down');
    return new Response(typeof payload === 'string' ? payload : JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  };
  const response = await handleInquiry(post(body, options), { env, fetch: fetchImpl });
  const json = await response.json();
  return { status: response.status, json, calls };
}

test.beforeEach(() => {
  resetRateLimits();
});

test('sends a valid brief to chris@madebylumi.com', async () => {
  const result = await send(valid, { origin: 'https://madebylumi.com' });
  assert.equal(result.status, 200);
  assert.deepEqual(result.json, { ok: true });
  assert.equal(result.calls.length, 1);
  assert.equal(result.calls[0].url, 'https://api.resend.com/emails');
  const payload = JSON.parse(result.calls[0].init.body);
  assert.deepEqual(payload.to, [RECIPIENT]);
  assert.equal(payload.reply_to, 'ada@example.com');
  assert.equal(payload.from, env.INQUIRY_FROM);
  assert.equal(payload.subject, 'Project brief from Ada Lovelace');
  assert.match(payload.text, /What I’d like to improve:\nMake it easier for customers to book a session\./);
  assert.equal(result.calls[0].init.headers.Authorization, `Bearer ${env.RESEND_API_KEY}`);
  assert.equal(JSON.stringify(result.json).includes(env.RESEND_API_KEY), false);
});

test('rejects missing name, email, and brief without sending', async () => {
  const bodies = [
    { ...valid, name: '   ' },
    { ...valid, email: 'not-an-email' },
    { ...valid, message: '' },
    { ...valid, message: 'x'.repeat(801) },
    { ...valid, need: 'A free website tomorrow' },
    { ...valid, timing: 'Right now' },
    {},
  ];
  for (let i = 0; i < bodies.length; i += 1) {
    const result = await send(bodies[i], { ip: `198.51.100.${i + 1}` });
    assert.equal(result.status, 400);
    assert.equal(result.json.ok, false);
    assert.equal(result.calls.length, 0);
  }
});

test('honeypot does not send and does not claim success', async () => {
  const result = await send({ ...valid, hp_field: 'https://spam.example' }, { ip: '203.0.113.20' });
  assert.equal(result.status, 400);
  assert.equal(result.json.ok, false);
  assert.equal(result.calls.length, 0);
});

test('strips newlines from the name before the subject', async () => {
  const result = await send({ ...valid, name: 'Ada\r\nBcc: evil@example.com' }, { ip: '203.0.113.21' });
  assert.equal(result.status, 200);
  const payload = JSON.parse(result.calls[0].init.body);
  assert.equal(payload.subject.includes('\n'), false);
  assert.equal(payload.subject, 'Project brief from Ada Bcc: evil@example.com');
});

test('missing credentials do not send', async () => {
  for (const missing of [{ RESEND_API_KEY: '', INQUIRY_FROM: env.INQUIRY_FROM }, { RESEND_API_KEY: env.RESEND_API_KEY, INQUIRY_FROM: '' }, {}]) {
    const calls = [];
    const response = await handleInquiry(post(valid, { ip: `203.0.113.${missing.RESEND_API_KEY ? 30 : 31}` }), {
      env: missing,
      fetch: async () => {
        calls.push(1);
        return new Response('{}', { status: 200 });
      },
    });
    const json = await response.json();
    assert.equal(response.status, 503);
    assert.equal(json.error, 'unavailable');
    assert.equal(json.ok, false);
    assert.equal(calls.length, 0);
    assert.equal(JSON.stringify(json).includes('RESEND'), false);
  }
});

test('provider failure becomes a send error and hides the provider body', async () => {
  const failed = await send(valid, { ip: '203.0.113.40', resendStatus: 422, resendBody: { message: 'domain is not verified', key: 're_test_key_not_real' } });
  assert.equal(failed.status, 502);
  assert.equal(failed.json.error, 'send_failed');
  assert.equal(JSON.stringify(failed.json).includes('re_test_key_not_real'), false);
  assert.equal(JSON.stringify(failed.json).includes('not verified'), false);

  const thrown = await send(valid, { ip: '203.0.113.41', resendThrow: true });
  assert.equal(thrown.status, 502);
  assert.equal(thrown.calls.length, 1);
});

test('rate limit stops the sixth post from one address', async () => {
  const ip = '203.0.113.50';
  for (let i = 0; i < 5; i += 1) {
    const result = await send(valid, { ip });
    assert.equal(result.status, 200);
  }
  const blocked = await send(valid, { ip });
  assert.equal(blocked.status, 429);
  assert.equal(blocked.json.error, 'rate');
  assert.equal(blocked.calls.length, 0);
});

test('rejects a foreign browser origin and a broken body', async () => {
  const foreign = await send(valid, { ip: '203.0.113.60', origin: 'https://evil.example' });
  assert.equal(foreign.status, 403);
  assert.equal(foreign.calls.length, 0);

  const lookalike = await send(valid, { ip: '203.0.113.61', origin: 'https://madebylumi.com.evil.example' });
  assert.equal(lookalike.status, 403);

  const preview = await send(valid, { ip: '203.0.113.62', origin: 'https://madebylumi-git-branch.vercel.app' });
  assert.equal(preview.status, 200);

  const local = await send(valid, { ip: '203.0.113.63', origin: 'http://127.0.0.1:8765' });
  assert.equal(local.status, 200);

  const badJson = await send(valid, { ip: '203.0.113.64', raw: '{not json' });
  assert.equal(badJson.status, 400);
  assert.equal(badJson.calls.length, 0);

  const huge = await send(valid, { ip: '203.0.113.65', raw: `{"message":"${'a'.repeat(13000)}"}` });
  assert.equal(huge.status, 413);

  const get = await handleInquiry(new Request('https://madebylumi.com/api/inquiry', { method: 'GET' }), { env });
  assert.equal(get.status, 405);
});

test('the page keeps its fields and no longer claims the brief stays local', () => {
  const html = readFileSync(join(root, 'start-a-project.html'), 'utf8');
  const script = readFileSync(join(root, 'app.js'), 'utf8');
  assert.match(html, /id="need"/);
  assert.match(html, /id="goal"/);
  assert.match(html, /id="timing"/);
  assert.match(html, /id="name"/);
  assert.match(html, /id="email"/);
  assert.match(html, /id="hp_field"/);
  assert.match(html, /id="form-status"/);
  assert.match(html, /id="download"/);
  assert.match(html, /Send my project brief/);
  assert.doesNotMatch(html, /Nothing is saved or sent/);
  assert.doesNotMatch(html, /within 24 hours/);
  assert.match(script, /\/api\/inquiry/);
  assert.match(script, /Sent to chris@madebylumi.com/);
  assert.doesNotMatch(script, /within 24 hours/);
  const other = readFileSync(join(root, 'index.html'), 'utf8');
  assert.doesNotMatch(other, /api\/inquiry/);
});

test('buildBrief matches the on-page starting point', () => {
  const text = buildBrief({
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    need: 'A new or better website',
    timing: 'Just exploring',
    message: 'A clearer booking path.',
  });
  assert.match(text, /^Made by Lumi — Project starting point/);
  assert.match(text, /To discuss: scope, timing, cost and support\.$/);
});

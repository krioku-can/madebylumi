import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import {
  bareAddress,
  buildCopy,
  forwardConfig,
  handleForward,
  parseRoutes,
  signPayload,
  submitterAddress,
} from '../lib/forward-inquiry.mjs';

const SECRET = `whsec_${Buffer.from('test-secret-not-real-0123456789').toString('base64')}`;
const NOW = 1_800_000_000_000;
const INBOUND = 'client@example.resend.app';
const SENDER = 'form-submission@squarespace.info';
const routes = [
  {
    inbound: INBOUND,
    to: ['one@example.com', 'two@example.com'],
    from: 'Client Website <inquiries@madebylumi.com>',
    senders: [SENDER],
  },
];
const env = {
  RESEND_WEBHOOK_SECRET: SECRET,
  RESEND_RECEIVING_KEY: 're_read_not_real',
  RESEND_API_KEY: 're_send_not_real',
  FORWARD_ROUTES: JSON.stringify(routes),
  FORWARD_ALERT_TO: 'owner@example.com',
};

const received = {
  object: 'email',
  id: 'abc-123',
  from: SENDER,
  to: [INBOUND],
  subject: 'Form Submission - Contact',
  html: '<p>Name: Pat</p><p>Email: pat@example.org</p>',
  text: 'Name: Pat\nEmail: pat@example.org\nMessage: Hello',
  headers: { from: `Squarespace <${SENDER}>` },
  reply_to: ['Pat <pat@example.org>'],
  authentication: { spf: 'pass', dkim: 'pass', dmarc: 'pass' },
};

function event(overrides = {}) {
  return {
    type: 'email.received',
    created_at: '2026-11-19T18:00:00.000Z',
    data: { email_id: 'abc-123', from: SENDER, to: [INBOUND], subject: 'Form Submission - Contact', ...overrides },
  };
}

async function signedRequest(payload, { secret = SECRET, timestamp = Math.floor(NOW / 1000), tamper = false } = {}) {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const id = 'msg_test';
  const signature = await signPayload(secret, id, String(timestamp), body);
  return new Request('https://madebylumi.com/api/forward-inquiry', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'svix-id': id,
      'svix-timestamp': String(timestamp),
      'svix-signature': `v1,${tamper ? 'x' : ''}${signature}`,
    },
    body,
  });
}

function fakeResend({ email = received, readStatus = 200, sendStatus = 200, sendThrow = false } = {}) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init, body: init.body ? JSON.parse(init.body) : null });
    if (url.includes('/emails/receiving/')) {
      return new Response(JSON.stringify(email), { status: readStatus });
    }
    if (sendThrow) throw new Error('network down');
    return new Response(JSON.stringify({ id: 'sent_1' }), { status: sendStatus });
  };
  return { calls, fetchImpl };
}

async function run(request, resend, extraEnv = {}) {
  const response = await handleForward(request, { env: { ...env, ...extraEnv }, fetch: resend.fetchImpl, now: () => NOW });
  return { status: response.status, json: await response.json() };
}

test('signature matches the Svix scheme Resend documents', async () => {
  const key = Buffer.from(SECRET.slice(6), 'base64');
  const expected = createHmac('sha256', key).update('id1.123.{"a":1}').digest('base64');
  assert.equal(await signPayload(SECRET, 'id1', '123', '{"a":1}'), expected);
});

test('forwards one copy to every recipient with reply-to the submitter', async () => {
  const resend = fakeResend();
  const result = await run(await signedRequest(event()), resend);
  assert.equal(result.status, 200);
  assert.deepEqual(result.json, { ok: true, forwarded: 2 });
  assert.equal(resend.calls.length, 2);
  assert.match(resend.calls[0].url, /\/emails\/receiving\/abc-123$/);
  assert.equal(resend.calls[0].init.headers.Authorization, 'Bearer re_read_not_real');
  const send = resend.calls[1];
  assert.equal(send.url, 'https://api.resend.com/emails');
  assert.equal(send.init.headers.Authorization, 'Bearer re_send_not_real');
  assert.equal(send.init.headers['Idempotency-Key'], 'forward-abc-123');
  assert.deepEqual(send.body.to, ['one@example.com', 'two@example.com']);
  assert.equal(send.body.from, 'Client Website <inquiries@madebylumi.com>');
  assert.equal(send.body.reply_to, 'pat@example.org');
  assert.equal(send.body.subject, 'Form Submission - Contact');
  assert.equal(send.body.html, received.html);
  assert.equal(send.body.text, received.text);
});

test('a retried webhook reuses the same idempotency key', async () => {
  const first = fakeResend();
  const second = fakeResend();
  await run(await signedRequest(event()), first);
  await run(await signedRequest(event()), second);
  assert.equal(first.calls[1].init.headers['Idempotency-Key'], second.calls[1].init.headers['Idempotency-Key']);
});

test('rejects a bad signature, a wrong secret and an old timestamp', async () => {
  for (const options of [
    { tamper: true },
    { secret: `whsec_${Buffer.from('other').toString('base64')}` },
    { timestamp: Math.floor(NOW / 1000) - 3600 },
  ]) {
    const resend = fakeResend();
    const result = await run(await signedRequest(event(), options), resend);
    assert.equal(result.status, 401);
    assert.equal(resend.calls.length, 0);
  }
});

test('rejects missing signature headers', async () => {
  const resend = fakeResend();
  const request = new Request('https://madebylumi.com/api/forward-inquiry', { method: 'POST', body: JSON.stringify(event()) });
  const result = await run(request, resend);
  assert.equal(result.status, 401);
  assert.equal(resend.calls.length, 0);
});

test('ignores other event types and other inbound addresses without sending', async () => {
  for (const payload of [{ ...event(), type: 'email.sent' }, event({ to: ['someone-else@example.resend.app'] })]) {
    const resend = fakeResend();
    const result = await run(await signedRequest(payload), resend);
    assert.equal(result.status, 200);
    assert.ok(result.json.ignored);
    assert.equal(resend.calls.length, 0);
  }
});

test('an unlisted sender gets no copy, only an alert to the owner', async () => {
  const resend = fakeResend();
  const result = await run(await signedRequest(event({ from: 'spam@example.net' })), resend);
  assert.equal(result.status, 200);
  assert.equal(result.json.ignored, 'sender');
  assert.equal(resend.calls.length, 1);
  assert.deepEqual(resend.calls[0].body.to, ['owner@example.com']);
  assert.doesNotMatch(resend.calls[0].body.text, /pat@example\.org/);
});

test('an email that fails SPF and DKIM gets no copy, only an alert', async () => {
  const resend = fakeResend({ email: { ...received, authentication: { spf: 'fail', dkim: 'fail', dmarc: 'fail' } } });
  const result = await run(await signedRequest(event()), resend);
  assert.equal(result.json.ignored, 'authentication');
  assert.equal(resend.calls.length, 2);
  assert.deepEqual(resend.calls[1].body.to, ['owner@example.com']);
});

test('a failed send returns 502 so Resend retries, and alerts the owner', async () => {
  const resend = fakeResend({ sendStatus: 500 });
  const result = await run(await signedRequest(event()), resend);
  assert.equal(result.status, 502);
  const alert = resend.calls.at(-1);
  assert.deepEqual(alert.body.to, ['owner@example.com']);
  assert.equal(alert.init.headers['Idempotency-Key'], 'forward-alert-abc-123');
});

test('a failed read returns 502', async () => {
  const resend = fakeResend({ readStatus: 404 });
  const result = await run(await signedRequest(event()), resend);
  assert.equal(result.status, 502);
});

test('a network error on send returns 502', async () => {
  const resend = fakeResend({ sendThrow: true });
  const result = await run(await signedRequest(event()), resend);
  assert.equal(result.status, 502);
});

test('answers 503 when not configured, before reading anything', async () => {
  const resend = fakeResend();
  const result = await run(await signedRequest(event()), resend, { FORWARD_ROUTES: '' });
  assert.equal(result.status, 503);
  assert.equal(resend.calls.length, 0);
});

test('only POST is allowed', async () => {
  const resend = fakeResend();
  const response = await handleForward(new Request('https://madebylumi.com/api/forward-inquiry'), { env, fetch: resend.fetchImpl });
  assert.equal(response.status, 405);
});

test('config rejects bad routes', () => {
  assert.equal(parseRoutes('not json'), null);
  assert.equal(parseRoutes('[]'), null);
  assert.equal(parseRoutes(JSON.stringify([{ ...routes[0], to: [] }])), null);
  assert.equal(parseRoutes(JSON.stringify([{ ...routes[0], to: ['not an address'] }])), null);
  assert.equal(parseRoutes(JSON.stringify([{ ...routes[0], senders: [] }])), null);
  assert.equal(parseRoutes(JSON.stringify([{ ...routes[0], from: 'Bad\r\nBcc: x@y.com <a@b.com>' }])), null);
  assert.equal(forwardConfig({ ...env, RESEND_WEBHOOK_SECRET: 'nope' }), null);
  assert.ok(forwardConfig(env));
});

test('finds the submitter from reply-to, a reply-to header, or an Email line', () => {
  assert.equal(submitterAddress(received), 'pat@example.org');
  assert.equal(submitterAddress({ reply_to: [], headers: { 'reply-to': 'Sam <sam@example.org>' } }), 'sam@example.org');
  assert.equal(submitterAddress({ reply_to: [], text: 'Name: Lee\nEmail: lee@example.org\n' }), 'lee@example.org');
  assert.equal(submitterAddress({ reply_to: [], text: 'no address here' }), '');
});

test('copy has a clean subject and no reply-to when none is known', () => {
  const copy = buildCopy(routes[0], { subject: 'Line one\r\nBcc: evil@example.com', text: 'hi', reply_to: [] });
  assert.equal(copy.subject, 'Line one Bcc: evil@example.com');
  assert.equal(copy.reply_to, undefined);
  assert.equal(buildCopy(routes[0], { subject: '' }).subject, 'New website inquiry');
  assert.ok(buildCopy(routes[0], {}).text);
});

test('bareAddress handles names and junk', () => {
  assert.equal(bareAddress('Pat <PAT@Example.org>'), 'pat@example.org');
  assert.equal(bareAddress('x'), '');
});

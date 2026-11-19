// Forwards client website form notifications to more than one inbox.
//
// Flow: a website form (for example Squarespace) sends its one notification
// email to a Resend receiving address. Resend posts an `email.received`
// webhook here. We verify the webhook, fetch the full email from Resend, and
// send one copy to every configured recipient, with reply-to set to the
// person who filled in the form.
//
// Everything client-specific lives in the environment, because this
// repository is public:
//   RESEND_WEBHOOK_SECRET    signing secret of the Resend webhook (whsec_...)
//   RESEND_RECEIVING_KEY     Resend key that can read received emails
//   RESEND_API_KEY           existing sending key (used to send the copies)
//   FORWARD_ROUTES           JSON: [{ "inbound": "x@y.resend.app",
//                                     "to": ["a@b.com"], "from": "Name <inquiries@madebylumi.com>",
//                                     "senders": ["form-submission@squarespace.info"] }]
//   FORWARD_ALERT_TO         optional: where to send a short note if a copy fails

const RESEND = 'https://api.resend.com';
const TOLERANCE_SECONDS = 5 * 60;
const MAX_WEBHOOK_BODY = 64 * 1024;
const MAX_HTML = 900 * 1024;
const MAX_TEXT = 200 * 1024;

function json(status, body) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function bareAddress(value) {
  const text = String(value ?? '').trim();
  const angle = text.match(/<([^<>\s]+@[^<>\s]+)>/);
  const address = (angle ? angle[1] : text).trim().toLowerCase();
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address) ? address : '';
}

function validAddressLine(value) {
  return typeof value === 'string' && !/[\r\n]/.test(value) && bareAddress(value) !== '';
}

export function parseRoutes(raw) {
  let list;
  try {
    list = JSON.parse(String(raw ?? ''));
  } catch {
    return null;
  }
  if (!Array.isArray(list) || list.length === 0) return null;
  const routes = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') return null;
    const inbound = bareAddress(item.inbound);
    const to = Array.isArray(item.to) ? item.to.map(bareAddress) : [];
    const senders = Array.isArray(item.senders) ? item.senders.map(bareAddress) : [];
    if (!inbound || to.length === 0 || to.length > 10 || to.includes('')) return null;
    if (senders.length === 0 || senders.includes('')) return null;
    if (!validAddressLine(item.from)) return null;
    routes.push({ inbound, to, senders, from: item.from.trim() });
  }
  return routes;
}

export function forwardConfig(env = process.env) {
  const secret = String(env.RESEND_WEBHOOK_SECRET ?? '').trim();
  const readKey = String(env.RESEND_RECEIVING_KEY ?? '').trim();
  const sendKey = String(env.RESEND_API_KEY ?? '').trim();
  const routes = parseRoutes(env.FORWARD_ROUTES);
  const alertTo = bareAddress(env.FORWARD_ALERT_TO);
  if (!secret.startsWith('whsec_') || !readKey || !sendKey || !routes) return null;
  return { secret, readKey, sendKey, routes, alertTo };
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Resend signs webhooks the Svix way: HMAC-SHA256 over "id.timestamp.body",
// keyed with the base64 part of the whsec_ secret, sent as "v1,<base64>".
export async function signPayload(secret, id, timestamp, body) {
  const keyBytes = Uint8Array.from(Buffer.from(secret.slice('whsec_'.length), 'base64'));
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${body}`));
  return Buffer.from(mac).toString('base64');
}

export async function verifyWebhook(secret, headers, body, nowSeconds) {
  const id = headers.get('svix-id');
  const timestamp = headers.get('svix-timestamp');
  const signatures = headers.get('svix-signature');
  if (!id || !timestamp || !signatures || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(nowSeconds - Number(timestamp)) > TOLERANCE_SECONDS) return false;
  const expected = await signPayload(secret, id, timestamp, body);
  return signatures
    .split(' ')
    .map((part) => part.trim())
    .filter((part) => part.startsWith('v1,'))
    .some((part) => timingSafeEqual(part.slice(3), expected));
}

export function pickRoute(routes, recipients) {
  const list = (Array.isArray(recipients) ? recipients : []).map(bareAddress);
  return routes.find((route) => list.includes(route.inbound)) || null;
}

// The person who filled in the form: the notification's reply-to if it has
// one, otherwise an "Email:" line in the body.
export function submitterAddress(email) {
  const replyTo = Array.isArray(email.reply_to) ? email.reply_to : [email.reply_to];
  for (const value of replyTo) {
    const address = bareAddress(value);
    if (address) return address;
  }
  const headerReply = bareAddress(email.headers?.['reply-to']);
  if (headerReply) return headerReply;
  const text = String(email.text ?? '');
  const line = text.match(/^\s*e-?mail(?: address)?\s*:\s*(\S+@\S+)\s*$/im);
  return line ? bareAddress(line[1]) : '';
}

export function cleanSubject(value) {
  const subject = String(value ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
  return subject || 'New website inquiry';
}

export function buildCopy(route, email) {
  const copy = {
    from: route.from,
    to: route.to,
    subject: cleanSubject(email.subject),
  };
  const replyTo = submitterAddress(email);
  if (replyTo) copy.reply_to = replyTo;
  const html = typeof email.html === 'string' ? email.html : '';
  const text = typeof email.text === 'string' ? email.text : '';
  if (html && html.length <= MAX_HTML) copy.html = html;
  if (text && text.length <= MAX_TEXT) copy.text = text;
  if (!copy.html && !copy.text) copy.text = '(The form notification had no readable body.)';
  return copy;
}

async function sendEmail(fetchImpl, key, idempotencyKey, payload) {
  return fetchImpl(`${RESEND}/emails`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(payload),
  });
}

async function alertFailure(fetchImpl, config, route, emailId, reason) {
  if (!config.alertTo) return;
  try {
    await sendEmail(fetchImpl, config.sendKey, `forward-alert-${emailId}`, {
      from: route.from,
      to: [config.alertTo],
      subject: 'Form forward needs a look',
      text: [
        'A website form notification reached the router but no copy went out.',
        '',
        `Inbound address: ${route.inbound}`,
        `Resend received email id: ${emailId}`,
        `Reason: ${reason}`,
        '',
        'If this was a send problem, Resend retries the webhook automatically. The original is kept under Emails > Receiving in Resend.',
      ].join('\n'),
    });
  } catch (error) {
    console.error('forward alert failed', error instanceof Error ? error.message : 'error');
  }
}

export async function handleForward(request, deps = {}) {
  const fetchImpl = deps.fetch || globalThis.fetch;
  const nowSeconds = Math.floor((deps.now?.() ?? Date.now()) / 1000);
  if (request.method !== 'POST') return json(405, { ok: false, error: 'method' });

  const config = forwardConfig(deps.env || process.env);
  if (!config) {
    console.error('form forward is not configured');
    return json(503, { ok: false, error: 'unavailable' });
  }

  let body = '';
  try {
    body = await request.text();
  } catch {
    return json(400, { ok: false, error: 'body' });
  }
  if (body.length > MAX_WEBHOOK_BODY) return json(413, { ok: false, error: 'body' });
  if (!(await verifyWebhook(config.secret, request.headers, body, nowSeconds))) {
    return json(401, { ok: false, error: 'signature' });
  }

  let event;
  try {
    event = JSON.parse(body);
  } catch {
    return json(400, { ok: false, error: 'body' });
  }
  if (event?.type !== 'email.received') return json(200, { ok: true, ignored: 'type' });

  const data = event.data || {};
  const emailId = String(data.email_id ?? '');
  if (!/^[A-Za-z0-9-]{1,100}$/.test(emailId)) return json(200, { ok: true, ignored: 'id' });

  const route = pickRoute(config.routes, data.to);
  if (!route) return json(200, { ok: true, ignored: 'address' });

  const sender = bareAddress(data.from);
  if (!route.senders.includes(sender)) {
    console.warn('form forward held an email from a sender that is not on the list');
    await alertFailure(fetchImpl, config, route, emailId, 'it came from a sender that is not on the list, so no copy was sent');
    return json(200, { ok: true, ignored: 'sender' });
  }

  let email;
  try {
    const response = await fetchImpl(`${RESEND}/emails/receiving/${emailId}`, {
      headers: { Authorization: `Bearer ${config.readKey}` },
    });
    if (!response.ok) {
      console.error('form forward fetch failed', response.status);
      await alertFailure(fetchImpl, config, route, emailId, `could not read the email (${response.status})`);
      return json(502, { ok: false, error: 'fetch_failed' });
    }
    email = await response.json();
  } catch (error) {
    console.error('form forward fetch failed', error instanceof Error ? error.message : 'error');
    await alertFailure(fetchImpl, config, route, emailId, 'could not reach Resend to read the email');
    return json(502, { ok: false, error: 'fetch_failed' });
  }

  // Check again against the full email, not only the webhook summary.
  if (bareAddress(email.from) !== sender) {
    await alertFailure(fetchImpl, config, route, emailId, 'its sender did not match the webhook, so no copy was sent');
    return json(200, { ok: true, ignored: 'sender' });
  }
  const auth = email.authentication;
  if (auth && auth.spf !== 'pass' && auth.dkim !== 'pass') {
    console.warn('form forward held an email that failed SPF and DKIM');
    await alertFailure(fetchImpl, config, route, emailId, 'it failed SPF and DKIM checks, so no copy was sent');
    return json(200, { ok: true, ignored: 'authentication' });
  }

  const copy = buildCopy(route, email);
  try {
    const response = await sendEmail(fetchImpl, config.sendKey, `forward-${emailId}`, copy);
    if (!response.ok) {
      const detail = await response.text();
      console.error('form forward send failed', response.status, detail.slice(0, 300));
      await alertFailure(fetchImpl, config, route, emailId, `the copy was refused (${response.status})`);
      return json(502, { ok: false, error: 'send_failed' });
    }
  } catch (error) {
    console.error('form forward send failed', error instanceof Error ? error.message : 'error');
    await alertFailure(fetchImpl, config, route, emailId, 'could not reach Resend to send the copy');
    return json(502, { ok: false, error: 'send_failed' });
  }

  return json(200, { ok: true, forwarded: copy.to.length });
}

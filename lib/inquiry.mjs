// Sends a Start a Project brief to chris@madebylumi.com.
// Credentials come only from the environment: RESEND_API_KEY and INQUIRY_FROM.

export const RECIPIENT = 'chris@madebylumi.com';
export const RATE_LIMIT = 5;
export const RATE_WINDOW_MS = 10 * 60 * 1000;
const MAX_BODY = 12000;

const NEEDS = new Set([
  'A new or better website',
  'Lumi Voice for incoming calls',
  'A tool to simplify a task',
  'I need help finding the starting point',
]);

const TIMINGS = new Set([
  'Just exploring',
  'Soon, once we agree on the plan',
  'In the next few months',
  'I have a date to discuss',
]);

const buckets = new Map();

export function resetRateLimits() {
  buckets.clear();
}

export function cleanLine(value, max) {
  const text = String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text || text.length > max) return '';
  return text;
}

export function cleanMessage(value) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
}

export function validEmail(value) {
  if (!value || value.length > 200) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function mailConfig(env = process.env) {
  const key = String(env.RESEND_API_KEY ?? '').trim();
  const from = String(env.INQUIRY_FROM ?? '').trim();
  if (!key || !from.includes('@') || /[\r\n]/.test(from)) return null;
  return { key, from };
}

export function honeypotTripped(data) {
  if (!data || typeof data !== 'object') return false;
  const value = data.hp_field;
  if (value == null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  return true;
}

export function validateInquiry(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false };
  const name = cleanLine(data.name, 120);
  const email = cleanLine(data.email, 200);
  const message = cleanMessage(data.message);
  const need = typeof data.need === 'string' ? data.need : '';
  const timing = typeof data.timing === 'string' ? data.timing : '';
  if (!name || !validEmail(email) || !message || message.length > 800) return { ok: false };
  if (!NEEDS.has(need) || !TIMINGS.has(timing)) return { ok: false };
  return { ok: true, value: { name, email, message, need, timing } };
}

export function buildBrief({ name, email, need, timing, message }) {
  return [
    'Made by Lumi — Project starting point',
    '',
    `Name: ${name}`,
    `Email: ${email}`,
    '',
    `I’m thinking about: ${need}`,
    '',
    'What I’d like to improve:',
    message,
    '',
    `Timing: ${timing}`,
    '',
    'To discuss: scope, timing, cost and support.',
  ].join('\n');
}

export function originAllowed(origin) {
  if (!origin) return true;
  let url;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  const host = url.hostname;
  if (url.protocol === 'https:' && (host === 'madebylumi.com' || host.endsWith('.madebylumi.com'))) return true;
  if (url.protocol === 'https:' && (host === 'vercel.app' || host.endsWith('.vercel.app'))) return true;
  if (url.protocol === 'http:' && (host === 'localhost' || host === '127.0.0.1')) return true;
  return false;
}

export function clientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  const raw = forwarded ? forwarded.split(',')[0] : (request.headers.get('x-real-ip') || '');
  const ip = raw.trim().slice(0, 80);
  return ip || 'unknown';
}

function takeSlot(ip, now) {
  const recent = (buckets.get(ip) || []).filter((time) => now - time < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    buckets.set(ip, recent);
    return false;
  }
  recent.push(now);
  buckets.set(ip, recent);
  if (buckets.size > 2000) buckets.clear();
  return true;
}

function json(status, body) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function deliverBrief(config, brief, fetchImpl) {
  return fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.from,
      to: [RECIPIENT],
      reply_to: brief.email,
      subject: `Project brief from ${brief.name}`,
      text: brief.text,
    }),
  });
}

export async function handleInquiry(request, deps = {}) {
  const fetchImpl = deps.fetch || globalThis.fetch;
  if (request.method !== 'POST') return json(405, { ok: false, error: 'method' });
  if (!originAllowed(request.headers.get('origin'))) return json(403, { ok: false, error: 'origin' });

  const ip = clientIp(request);
  if (!takeSlot(ip, deps.now?.() ?? Date.now())) return json(429, { ok: false, error: 'rate' });

  let raw = '';
  try {
    raw = await request.text();
  } catch (error) {
    console.error('inquiry body read failed', error instanceof Error ? error.message : 'error');
    return json(400, { ok: false, error: 'validation' });
  }
  if (raw.length > MAX_BODY) return json(413, { ok: false, error: 'validation' });

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return json(400, { ok: false, error: 'validation' });
  }
  if (honeypotTripped(data)) return json(400, { ok: false, error: 'validation' });

  const parsed = validateInquiry(data);
  if (!parsed.ok) return json(400, { ok: false, error: 'validation' });

  const config = mailConfig(deps.env || process.env);
  if (!config) {
    console.error('inquiry email is not configured');
    return json(503, { ok: false, error: 'unavailable' });
  }

  const text = buildBrief(parsed.value);
  try {
    const response = await deliverBrief(config, { ...parsed.value, text }, fetchImpl);
    if (!response.ok) {
      const detail = await response.text();
      console.error('inquiry send failed', response.status, detail.slice(0, 300));
      return json(502, { ok: false, error: 'send_failed' });
    }
  } catch (error) {
    console.error('inquiry send failed', error instanceof Error ? error.message : 'error');
    return json(502, { ok: false, error: 'send_failed' });
  }

  return json(200, { ok: true });
}

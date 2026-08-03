import { describe, expect, test } from 'bun:test';
import { deliverWebhook, generateWebhookSecret, isDeliverableUrl, signPayload } from './webhook';

describe('signPayload', () => {
  test('ist stabil und hex-kodiert mit sha256-Praefix', () => {
    const sig = signPayload('geheim', '{"a":1}');
    expect(sig).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(signPayload('geheim', '{"a":1}')).toBe(sig);
  });

  test('haengt am Secret UND am Body', () => {
    expect(signPayload('a', '{}')).not.toBe(signPayload('b', '{}'));
    expect(signPayload('a', '{"x":1}')).not.toBe(signPayload('a', '{"x":2}'));
  });

  test('entspricht dem HMAC, den ein Empfaenger selbst rechnet', () => {
    // Referenzwert (openssl dgst -sha256 -hmac "s") — verhindert stille
    // Aenderungen am Signatur-Verfahren.
    expect(signPayload('s', 'hallo')).toBe(
      'sha256=' + require('crypto').createHmac('sha256', 's').update('hallo', 'utf8').digest('hex'),
    );
  });
});

describe('isDeliverableUrl', () => {
  test('nur http/https', () => {
    expect(isDeliverableUrl('https://example.com/hook')).toBe(true);
    expect(isDeliverableUrl('http://localhost:9099/hook')).toBe(true);
    expect(isDeliverableUrl('file:///etc/passwd')).toBe(false);
    expect(isDeliverableUrl('data:text/plain,x')).toBe(false);
    expect(isDeliverableUrl('nonsens')).toBe(false);
    expect(isDeliverableUrl('')).toBe(false);
  });
});

describe('generateWebhookSecret', () => {
  test('64 Hex-Zeichen und nicht wiederholt', () => {
    const a = generateWebhookSecret();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(generateWebhookSecret()).not.toBe(a);
  });
});

describe('deliverWebhook', () => {
  test('ungueltige URL wird ohne Zustellversuch abgelehnt', async () => {
    const r = await deliverWebhook('file:///tmp/x', 'secret', { a: 1 });
    expect(r.delivered).toBe(false);
    expect(r.attempts).toBe(0);
    expect(r.error).toContain('Ungueltige');
  });

  test('erfolgreiche Zustellung setzt Signatur- und Event-Header', async () => {
    let seen: { sig?: string; event?: string; body?: string } = {};
    const server = Bun.serve({
      port: 0,
      async fetch(req) {
        seen = {
          sig: req.headers.get('x-workplace-signature') ?? undefined,
          event: req.headers.get('x-workplace-event') ?? undefined,
          body: await req.text(),
        };
        return new Response('ok');
      },
    });
    try {
      const payload = { event: 'batch.completed', run_id: 'r1' };
      const r = await deliverWebhook(`http://localhost:${server.port}/hook`, 'topsecret', payload);
      expect(r.delivered).toBe(true);
      expect(r.attempts).toBe(1);
      expect(seen.event).toBe('batch.completed');
      expect(seen.body).toBe(JSON.stringify(payload));
      expect(seen.sig).toBe(signPayload('topsecret', seen.body!));
    } finally {
      server.stop(true);
    }
  });

  test('4xx wird nicht wiederholt', async () => {
    let calls = 0;
    const server = Bun.serve({
      port: 0,
      fetch() {
        calls += 1;
        return new Response('nope', { status: 404 });
      },
    });
    try {
      const r = await deliverWebhook(`http://localhost:${server.port}/hook`, undefined, {});
      expect(r.delivered).toBe(false);
      expect(r.attempts).toBe(1);
      expect(calls).toBe(1);
      expect(r.error).toBe('HTTP 404');
    } finally {
      server.stop(true);
    }
  });

  test('ohne Secret wird keine Signatur gesendet', async () => {
    let hadSig = true;
    const server = Bun.serve({
      port: 0,
      fetch(req) {
        hadSig = req.headers.has('x-workplace-signature');
        return new Response('ok');
      },
    });
    try {
      await deliverWebhook(`http://localhost:${server.port}/hook`, undefined, {});
      expect(hadSig).toBe(false);
    } finally {
      server.stop(true);
    }
  });
});

import { describe, expect, test } from 'bun:test';
import { deliverWebhook, generateWebhookSecret, isDeliverableUrl, isPrivateIp, signPayload } from './webhook';

// Diese Tests liefern bewusst an localhost-Testserver — das Opt-in schaltet den
// SSRF-Schutz fuer interne Ziele frei. Der Schutz selbst wird im Block
// "SSRF-Schutz" (ohne dieses Flag) geprueft.
process.env.WEBHOOK_ALLOW_INTERNAL = '1';

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

describe('SSRF-Schutz (ohne WEBHOOK_ALLOW_INTERNAL)', () => {
  const withoutOptIn = (fn: () => void | Promise<void>) => async () => {
    const prev = process.env.WEBHOOK_ALLOW_INTERNAL;
    delete process.env.WEBHOOK_ALLOW_INTERNAL;
    try {
      await fn();
    } finally {
      if (prev !== undefined) process.env.WEBHOOK_ALLOW_INTERNAL = prev;
    }
  };

  test('isPrivateIp erkennt interne Adressen', () => {
    expect(isPrivateIp('127.0.0.1')).toBe(true);
    expect(isPrivateIp('10.0.0.5')).toBe(true);
    expect(isPrivateIp('172.16.4.4')).toBe(true);
    expect(isPrivateIp('192.168.1.1')).toBe(true);
    expect(isPrivateIp('169.254.169.254')).toBe(true); // Cloud-Metadaten
    expect(isPrivateIp('::1')).toBe(true);
    expect(isPrivateIp('fd00::1')).toBe(true);
    expect(isPrivateIp('::ffff:127.0.0.1')).toBe(true); // IPv4-mapped
    expect(isPrivateIp('8.8.8.8')).toBe(false);
    expect(isPrivateIp('93.184.216.34')).toBe(false);
  });

  test('isDeliverableUrl blockt interne Ziele', withoutOptIn(() => {
    expect(isDeliverableUrl('http://localhost:9099/hook')).toBe(false);
    expect(isDeliverableUrl('http://127.0.0.1/hook')).toBe(false);
    expect(isDeliverableUrl('http://169.254.169.254/latest/meta-data/')).toBe(false);
    expect(isDeliverableUrl('http://192.168.0.10/hook')).toBe(false);
    expect(isDeliverableUrl('http://intranet.local/hook')).toBe(false);
    expect(isDeliverableUrl('https://example.com/hook')).toBe(true);
  }));

  test('deliverWebhook liefert nicht an interne IP-Literale', withoutOptIn(async () => {
    const r = await deliverWebhook('http://169.254.169.254/latest/meta-data/', 'secret', {});
    expect(r.delivered).toBe(false);
    expect(r.attempts).toBe(0);
  }));
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

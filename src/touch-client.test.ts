import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  LICENSE_TOUCH,
  LicenseTouchClient,
  LicenseTouchError,
  isLicenseQuotaExceeded,
  isLicenseTouchUnauthorized,
  touchLicenseSeat,
} from './index';

describe('touchLicenseSeat', () => {
  it('POSTs heartbeat with bearer token', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init });
      return new Response(JSON.stringify({ success: true, timestamp: '2026-01-01T00:00:00.000Z' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };
    const result = await touchLicenseSeat({
      apiAuthBaseUrl: 'https://auth.example.com/',
      accessToken: 'tok-1',
      fetchImpl,
    });
    assert.equal(result.success, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.url, `https://auth.example.com${LICENSE_TOUCH.HEARTBEAT_PATH}`);
    assert.equal((calls[0]?.init?.headers as Record<string, string>).Authorization, 'Bearer tok-1');
    assert.equal(calls[0]?.init?.method, 'POST');
  });

  it('maps 401 and 429 to typed errors', async () => {
    const unauthorized: typeof fetch = async () =>
      new Response(JSON.stringify({ message: 'nope' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      });
    await assert.rejects(
      () =>
        touchLicenseSeat({
          apiAuthBaseUrl: 'https://auth.example.com',
          accessToken: 'x',
          fetchImpl: unauthorized,
        }),
      (error: unknown) => isLicenseTouchUnauthorized(error),
    );
    const quota: typeof fetch = async () =>
      new Response(JSON.stringify({ errorCode: 'BIZ_4005' }), {
        status: 429,
        headers: { 'content-type': 'application/json' },
      });
    await assert.rejects(
      () =>
        touchLicenseSeat({
          apiAuthBaseUrl: 'https://auth.example.com',
          accessToken: 'x',
          fetchImpl: quota,
        }),
      (error: unknown) => isLicenseQuotaExceeded(error),
    );
  });

  it('rejects empty token', async () => {
    await assert.rejects(
      () =>
        touchLicenseSeat({
          apiAuthBaseUrl: 'https://auth.example.com',
          accessToken: '',
        }),
      (error: unknown) => error instanceof LicenseTouchError && error.code === 'NO_TOKEN',
    );
  });
});

describe('LicenseTouchClient', () => {
  it('touches immediately on start and stops the timer', async () => {
    let hits = 0;
    const fetchImpl: typeof fetch = async () => {
      hits += 1;
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };
    const client = new LicenseTouchClient({
      apiAuthBaseUrl: 'https://auth.example.com',
      getAccessToken: () => 'tok',
      intervalMs: 60_000,
      fetchImpl,
    });
    client.start();
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(hits, 1);
    assert.equal(client.isRunning, true);
    client.stop();
    assert.equal(client.isRunning, false);
  });

  it('coalesces concurrent touch() into one HTTP call', async () => {
    let hits = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetchImpl: typeof fetch = async () => {
      hits += 1;
      await gate;
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };
    const client = new LicenseTouchClient({
      apiAuthBaseUrl: 'https://auth.example.com',
      getAccessToken: () => 'tok',
      fetchImpl,
    });
    const a = client.touch();
    const b = client.touch();
    release();
    await Promise.all([a, b]);
    assert.equal(hits, 1);
  });
});

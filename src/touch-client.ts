import { LICENSE_TOUCH } from './constants';
import {
  LicenseTouchClientOptions,
  LicenseTouchError,
  LicenseTouchResult,
  TouchLicenseSeatInput,
} from './types';

function normalizeBaseUrl(apiAuthBaseUrl: string): string {
  return apiAuthBaseUrl.replace(/\/+$/, '');
}

/**
 * One-shot activity renew for an External App license seat.
 * Equivalent names: touch / heartbeat / lease renew — same api-auth endpoint.
 */
export async function touchLicenseSeat(
  input: TouchLicenseSeatInput,
): Promise<LicenseTouchResult> {
  const baseUrl = normalizeBaseUrl(input.apiAuthBaseUrl);
  if (!input.accessToken) {
    throw new LicenseTouchError({
      message: 'Missing OAuth access token for license touch',
      code: 'NO_TOKEN',
    });
  }
  const fetchImpl = input.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(`${baseUrl}${LICENSE_TOUCH.HEARTBEAT_PATH}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        Accept: 'application/json',
      },
    });
  } catch (error) {
    throw new LicenseTouchError({
      message: error instanceof Error ? error.message : 'License touch network error',
      code: 'NETWORK',
    });
  }
  let body: unknown;
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }
  }
  if (response.status === 401) {
    throw new LicenseTouchError({
      message: 'License touch unauthorized',
      code: 'UNAUTHORIZED',
      status: 401,
      body,
    });
  }
  if (response.status === 429) {
    throw new LicenseTouchError({
      message: 'License quota exceeded',
      code: 'QUOTA_EXCEEDED',
      status: 429,
      body,
    });
  }
  if (!response.ok) {
    throw new LicenseTouchError({
      message: `License touch failed with HTTP ${response.status}`,
      code: 'HTTP',
      status: response.status,
      body,
    });
  }
  const payload = (body ?? {}) as { success?: boolean; timestamp?: string };
  return {
    success: payload.success !== false,
    timestamp: payload.timestamp,
  };
}

/**
 * Interval-based activity tracking for browser or Node External Apps.
 * Call start() after OAuth; stop() on logout/unmount.
 */
export class LicenseTouchClient {
  private readonly options: LicenseTouchClientOptions;
  private timer: ReturnType<typeof setInterval> | null = null;
  private inFlight: Promise<void> | null = null;
  private running = false;

  constructor(options: LicenseTouchClientOptions) {
    this.options = options;
  }

  get isRunning(): boolean {
    return this.running;
  }

  async touch(): Promise<LicenseTouchResult> {
    const accessToken = await this.options.getAccessToken();
    if (!accessToken) {
      const error = new LicenseTouchError({
        message: 'Missing OAuth access token for license touch',
        code: 'NO_TOKEN',
      });
      this.options.onError?.(error);
      throw error;
    }
    if (this.inFlight) {
      await this.inFlight;
    }
    const run = (async (): Promise<LicenseTouchResult> => {
      try {
        const result = await touchLicenseSeat({
          apiAuthBaseUrl: this.options.apiAuthBaseUrl,
          accessToken,
          fetchImpl: this.options.fetchImpl,
        });
        this.options.onSuccess?.(result);
        return result;
      } catch (error) {
        const touchError =
          error instanceof LicenseTouchError
            ? error
            : new LicenseTouchError({
                message: error instanceof Error ? error.message : 'License touch failed',
                code: 'NETWORK',
              });
        this.options.onError?.(touchError);
        throw touchError;
      }
    })();
    this.inFlight = run.then(
      () => undefined,
      () => undefined,
    );
    try {
      return await run;
    } finally {
      this.inFlight = null;
    }
  }

  start(intervalMs?: number): void {
    if (this.running) {
      this.stop();
    }
    const ms = intervalMs ?? this.options.intervalMs ?? LICENSE_TOUCH.RECOMMENDED_INTERVAL_MS;
    this.running = true;
    void this.touch().catch(() => undefined);
    this.timer = setInterval(() => {
      void this.touch().catch(() => undefined);
    }, ms);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.running = false;
  }
}

export function isLicenseTouchUnauthorized(error: unknown): boolean {
  return error instanceof LicenseTouchError && error.code === 'UNAUTHORIZED';
}

export function isLicenseQuotaExceeded(error: unknown): boolean {
  return error instanceof LicenseTouchError && error.code === 'QUOTA_EXCEEDED';
}

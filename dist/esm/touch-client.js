import { LICENSE_TOUCH } from './constants.js';
import { LicenseTouchError, } from './types.js';
function normalizeBaseUrl(apiAuthBaseUrl) {
    const trimmed = apiAuthBaseUrl.trim();
    if (!trimmed) {
        throw new LicenseTouchError({
            message: 'Missing api-auth base URL for license touch',
            code: 'HTTP',
        });
    }
    return trimmed.replace(/\/+$/, '');
}
function toLicenseTouchError(error) {
    if (error instanceof LicenseTouchError) {
        return error;
    }
    if (error instanceof Error && error.name === 'AbortError') {
        return new LicenseTouchError({
            message: 'License touch timed out',
            code: 'TIMEOUT',
        });
    }
    return new LicenseTouchError({
        message: error instanceof Error ? error.message : 'License touch network error',
        code: 'NETWORK',
    });
}
async function parseJsonBody(response) {
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
        return undefined;
    }
    try {
        return await response.json();
    }
    catch {
        return undefined;
    }
}
function throwForHttpStatus(status, body) {
    if (status === 401) {
        throw new LicenseTouchError({
            message: 'License touch unauthorized',
            code: 'UNAUTHORIZED',
            status: 401,
            body,
        });
    }
    if (status === 429) {
        throw new LicenseTouchError({
            message: 'License quota exceeded',
            code: 'QUOTA_EXCEEDED',
            status: 429,
            body,
        });
    }
    throw new LicenseTouchError({
        message: `License touch failed with HTTP ${status}`,
        code: 'HTTP',
        status,
        body,
    });
}
/**
 * One-shot activity renew for an External App license seat.
 * Equivalent names: touch / heartbeat / lease renew — same api-auth endpoint.
 */
export async function touchLicenseSeat(input) {
    const baseUrl = normalizeBaseUrl(input.apiAuthBaseUrl);
    if (!input.accessToken) {
        throw new LicenseTouchError({
            message: 'Missing OAuth access token for license touch',
            code: 'NO_TOKEN',
        });
    }
    const fetchImpl = input.fetchImpl ?? fetch;
    const timeoutMs = input.timeoutMs ?? LICENSE_TOUCH.DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
        response = await fetchImpl(`${baseUrl}${LICENSE_TOUCH.HEARTBEAT_PATH}`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${input.accessToken}`,
                Accept: 'application/json',
            },
            signal: controller.signal,
        });
    }
    catch (error) {
        throw toLicenseTouchError(error);
    }
    finally {
        clearTimeout(timeoutId);
    }
    const body = await parseJsonBody(response);
    if (!response.ok) {
        throwForHttpStatus(response.status, body);
    }
    const payload = (body ?? {});
    const result = {
        success: payload.success !== false,
        timestamp: payload.timestamp,
        updatedCount: typeof payload.updatedCount === 'number' ? payload.updatedCount : undefined,
    };
    // api-auth: 0 rows = seat closed/stale — clients should re-OAuth (not treat as success).
    if (typeof result.updatedCount === 'number' && result.updatedCount === 0) {
        throw new LicenseTouchError({
            message: 'No active license seat to renew',
            code: 'SEAT_INACTIVE',
            body: result,
        });
    }
    return result;
}
/**
 * Interval-based activity tracking for browser or Node External Apps.
 * Call start() after OAuth; stop() on logout/unmount.
 * Concurrent touch() calls coalesce onto one in-flight HTTP request.
 */
export class LicenseTouchClient {
    options;
    timer = null;
    inFlight = null;
    running = false;
    constructor(options) {
        this.options = options;
    }
    get isRunning() {
        return this.running;
    }
    async touch() {
        if (this.inFlight) {
            return this.inFlight;
        }
        this.inFlight = this.executeTouch();
        try {
            return await this.inFlight;
        }
        finally {
            this.inFlight = null;
        }
    }
    async executeTouch() {
        const accessToken = await this.options.getAccessToken();
        if (!accessToken) {
            const error = new LicenseTouchError({
                message: 'Missing OAuth access token for license touch',
                code: 'NO_TOKEN',
            });
            this.options.onError?.(error);
            throw error;
        }
        try {
            const result = await touchLicenseSeat({
                apiAuthBaseUrl: this.options.apiAuthBaseUrl,
                accessToken,
                fetchImpl: this.options.fetchImpl,
                timeoutMs: this.options.timeoutMs,
            });
            this.options.onSuccess?.(result);
            return result;
        }
        catch (error) {
            const touchError = toLicenseTouchError(error);
            this.options.onError?.(touchError);
            throw touchError;
        }
    }
    start(intervalMs) {
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
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.running = false;
    }
}
export function isLicenseTouchUnauthorized(error) {
    return error instanceof LicenseTouchError && error.code === 'UNAUTHORIZED';
}
export function isLicenseQuotaExceeded(error) {
    return error instanceof LicenseTouchError && error.code === 'QUOTA_EXCEEDED';
}
/** True when api-auth reported zero AgentSession rows updated (seat gone / stale). */
export function isLicenseSeatInactiveResult(result) {
    return typeof result.updatedCount === 'number' && result.updatedCount === 0;
}
/** Auth or seat-loss errors that External Apps should handle with re-OAuth. */
export function isLicenseReauthRequired(error) {
    return (error instanceof LicenseTouchError &&
        (error.code === 'UNAUTHORIZED' ||
            error.code === 'NO_TOKEN' ||
            error.code === 'SEAT_INACTIVE'));
}

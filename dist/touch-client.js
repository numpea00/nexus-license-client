"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LicenseTouchClient = void 0;
exports.touchLicenseSeat = touchLicenseSeat;
exports.isLicenseTouchUnauthorized = isLicenseTouchUnauthorized;
exports.isLicenseQuotaExceeded = isLicenseQuotaExceeded;
const constants_1 = require("./constants");
const types_1 = require("./types");
function normalizeBaseUrl(apiAuthBaseUrl) {
    return apiAuthBaseUrl.replace(/\/+$/, '');
}
/**
 * One-shot activity renew for an External App license seat.
 * Equivalent names: touch / heartbeat / lease renew — same api-auth endpoint.
 */
async function touchLicenseSeat(input) {
    const baseUrl = normalizeBaseUrl(input.apiAuthBaseUrl);
    if (!input.accessToken) {
        throw new types_1.LicenseTouchError({
            message: 'Missing OAuth access token for license touch',
            code: 'NO_TOKEN',
        });
    }
    const fetchImpl = input.fetchImpl ?? fetch;
    let response;
    try {
        response = await fetchImpl(`${baseUrl}${constants_1.LICENSE_TOUCH.HEARTBEAT_PATH}`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${input.accessToken}`,
                Accept: 'application/json',
            },
        });
    }
    catch (error) {
        throw new types_1.LicenseTouchError({
            message: error instanceof Error ? error.message : 'License touch network error',
            code: 'NETWORK',
        });
    }
    let body;
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
        try {
            body = await response.json();
        }
        catch {
            body = undefined;
        }
    }
    if (response.status === 401) {
        throw new types_1.LicenseTouchError({
            message: 'License touch unauthorized',
            code: 'UNAUTHORIZED',
            status: 401,
            body,
        });
    }
    if (response.status === 429) {
        throw new types_1.LicenseTouchError({
            message: 'License quota exceeded',
            code: 'QUOTA_EXCEEDED',
            status: 429,
            body,
        });
    }
    if (!response.ok) {
        throw new types_1.LicenseTouchError({
            message: `License touch failed with HTTP ${response.status}`,
            code: 'HTTP',
            status: response.status,
            body,
        });
    }
    const payload = (body ?? {});
    return {
        success: payload.success !== false,
        timestamp: payload.timestamp,
    };
}
/**
 * Interval-based activity tracking for browser or Node External Apps.
 * Call start() after OAuth; stop() on logout/unmount.
 */
class LicenseTouchClient {
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
        const accessToken = await this.options.getAccessToken();
        if (!accessToken) {
            const error = new types_1.LicenseTouchError({
                message: 'Missing OAuth access token for license touch',
                code: 'NO_TOKEN',
            });
            this.options.onError?.(error);
            throw error;
        }
        if (this.inFlight) {
            await this.inFlight;
        }
        const run = (async () => {
            try {
                const result = await touchLicenseSeat({
                    apiAuthBaseUrl: this.options.apiAuthBaseUrl,
                    accessToken,
                    fetchImpl: this.options.fetchImpl,
                });
                this.options.onSuccess?.(result);
                return result;
            }
            catch (error) {
                const touchError = error instanceof types_1.LicenseTouchError
                    ? error
                    : new types_1.LicenseTouchError({
                        message: error instanceof Error ? error.message : 'License touch failed',
                        code: 'NETWORK',
                    });
                this.options.onError?.(touchError);
                throw touchError;
            }
        })();
        this.inFlight = run.then(() => undefined, () => undefined);
        try {
            return await run;
        }
        finally {
            this.inFlight = null;
        }
    }
    start(intervalMs) {
        if (this.running) {
            this.stop();
        }
        const ms = intervalMs ?? this.options.intervalMs ?? constants_1.LICENSE_TOUCH.RECOMMENDED_INTERVAL_MS;
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
exports.LicenseTouchClient = LicenseTouchClient;
function isLicenseTouchUnauthorized(error) {
    return error instanceof types_1.LicenseTouchError && error.code === 'UNAUTHORIZED';
}
function isLicenseQuotaExceeded(error) {
    return error instanceof types_1.LicenseTouchError && error.code === 'QUOTA_EXCEEDED';
}

export type LicenseTouchResult = {
    success: boolean;
    timestamp?: string;
};
export type TouchLicenseSeatInput = {
    /** api-auth origin, e.g. https://auth.example.com (no trailing slash). */
    apiAuthBaseUrl: string;
    /** OAuth access token for the External App (must carry externalAppId / clientId). */
    accessToken: string;
    /** Optional fetch override (tests / polyfills). */
    fetchImpl?: typeof fetch;
    /** Abort touch after this many ms (default LICENSE_TOUCH.DEFAULT_TIMEOUT_MS). */
    timeoutMs?: number;
};
export type LicenseTouchClientOptions = {
    apiAuthBaseUrl: string;
    getAccessToken: () => string | null | undefined | Promise<string | null | undefined>;
    /** Default: LICENSE_TOUCH.RECOMMENDED_INTERVAL_MS */
    intervalMs?: number;
    /** Default: LICENSE_TOUCH.DEFAULT_TIMEOUT_MS */
    timeoutMs?: number;
    onSuccess?: (result: LicenseTouchResult) => void;
    onError?: (error: LicenseTouchError) => void;
    fetchImpl?: typeof fetch;
};
export declare class LicenseTouchError extends Error {
    readonly status?: number;
    readonly body?: unknown;
    readonly code: 'UNAUTHORIZED' | 'QUOTA_EXCEEDED' | 'NETWORK' | 'HTTP' | 'NO_TOKEN' | 'TIMEOUT';
    constructor(params: {
        message: string;
        code: LicenseTouchError['code'];
        status?: number;
        body?: unknown;
    });
}

import { LicenseTouchClientOptions, LicenseTouchResult, TouchLicenseSeatInput } from './types';
/**
 * One-shot activity renew for an External App license seat.
 * Equivalent names: touch / heartbeat / lease renew — same api-auth endpoint.
 */
export declare function touchLicenseSeat(input: TouchLicenseSeatInput): Promise<LicenseTouchResult>;
/**
 * Interval-based activity tracking for browser or Node External Apps.
 * Call start() after OAuth; stop() on logout/unmount.
 */
export declare class LicenseTouchClient {
    private readonly options;
    private timer;
    private inFlight;
    private running;
    constructor(options: LicenseTouchClientOptions);
    get isRunning(): boolean;
    touch(): Promise<LicenseTouchResult>;
    start(intervalMs?: number): void;
    stop(): void;
}
export declare function isLicenseTouchUnauthorized(error: unknown): boolean;
export declare function isLicenseQuotaExceeded(error: unknown): boolean;

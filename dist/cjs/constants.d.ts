/**
 * Timers aligned with api-auth SESSION_TIMEOUTS / integrator contract.
 * Touch (= POST /sessions/heartbeat) renews the External App license seat.
 */
export declare const LICENSE_TOUCH: {
    /** Recommended interval while the app is actively used (visible tab / main loop). */
    readonly RECOMMENDED_INTERVAL_MS: number;
    /**
     * Safer interval when browser timers are throttled (hidden tab).
     * Must stay under api-auth active window (5 minutes).
     */
    readonly HIDDEN_INTERVAL_MS: number;
    /** api-auth counts a seat as active when lastHeartbeat is within this window. */
    readonly ACTIVE_WINDOW_MS: number;
    /** api-auth stale cleanup threshold (logoutAt). */
    readonly STALE_CLEANUP_MS: number;
    /** Default HTTP timeout for a single touch request. */
    readonly DEFAULT_TIMEOUT_MS: number;
    /** Path relative to api-auth base URL (no trailing slash on base). */
    readonly HEARTBEAT_PATH: "/sessions/heartbeat";
};

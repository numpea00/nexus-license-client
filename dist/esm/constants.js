/**
 * Timers aligned with api-auth SESSION_TIMEOUTS / integrator contract.
 * Touch (= POST /sessions/heartbeat) renews the External App license seat.
 */
export const LICENSE_TOUCH = {
    /** Recommended interval while the app is actively used (visible tab / main loop). */
    RECOMMENDED_INTERVAL_MS: 2 * 60 * 1000,
    /**
     * Safer interval when browser timers are throttled (hidden tab).
     * Must stay under api-auth active window (5 minutes).
     */
    HIDDEN_INTERVAL_MS: 60 * 1000,
    /** api-auth counts a seat as active when lastHeartbeat is within this window. */
    ACTIVE_WINDOW_MS: 5 * 60 * 1000,
    /** api-auth stale cleanup threshold (logoutAt). */
    STALE_CLEANUP_MS: 10 * 60 * 1000,
    /** Default HTTP timeout for a single touch request. */
    DEFAULT_TIMEOUT_MS: 15 * 1000,
    /** Path relative to api-auth base URL (no trailing slash on base). */
    HEARTBEAT_PATH: '/sessions/heartbeat',
};

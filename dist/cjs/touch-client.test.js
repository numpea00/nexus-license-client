"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const index_js_1 = require("./index.js");
(0, node_test_1.describe)('touchLicenseSeat', () => {
    (0, node_test_1.it)('POSTs heartbeat with bearer token', async () => {
        const calls = [];
        const fetchImpl = async (input, init) => {
            calls.push({ url: String(input), init });
            return new Response(JSON.stringify({ success: true, timestamp: '2026-01-01T00:00:00.000Z' }), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            });
        };
        const result = await (0, index_js_1.touchLicenseSeat)({
            apiAuthBaseUrl: 'https://auth.example.com/',
            accessToken: 'tok-1',
            fetchImpl,
        });
        strict_1.default.equal(result.success, true);
        strict_1.default.equal(result.updatedCount, undefined);
        strict_1.default.equal(calls.length, 1);
        strict_1.default.equal(calls[0]?.url, `https://auth.example.com${index_js_1.LICENSE_TOUCH.HEARTBEAT_PATH}`);
        strict_1.default.equal((calls[0]?.init?.headers).Authorization, 'Bearer tok-1');
        strict_1.default.equal(calls[0]?.init?.method, 'POST');
    });
    (0, node_test_1.it)('maps 401 and 429 to typed errors', async () => {
        const unauthorized = async () => new Response(JSON.stringify({ message: 'nope' }), {
            status: 401,
            headers: { 'content-type': 'application/json' },
        });
        await strict_1.default.rejects(() => (0, index_js_1.touchLicenseSeat)({
            apiAuthBaseUrl: 'https://auth.example.com',
            accessToken: 'x',
            fetchImpl: unauthorized,
        }), (error) => (0, index_js_1.isLicenseTouchUnauthorized)(error));
        const quota = async () => new Response(JSON.stringify({ errorCode: 'BIZ_4005' }), {
            status: 429,
            headers: { 'content-type': 'application/json' },
        });
        await strict_1.default.rejects(() => (0, index_js_1.touchLicenseSeat)({
            apiAuthBaseUrl: 'https://auth.example.com',
            accessToken: 'x',
            fetchImpl: quota,
        }), (error) => (0, index_js_1.isLicenseQuotaExceeded)(error));
    });
    (0, node_test_1.it)('rejects empty token', async () => {
        await strict_1.default.rejects(() => (0, index_js_1.touchLicenseSeat)({
            apiAuthBaseUrl: 'https://auth.example.com',
            accessToken: '',
        }), (error) => error instanceof index_js_1.LicenseTouchError && error.code === 'NO_TOKEN');
    });
    (0, node_test_1.it)('passes through updatedCount from api-auth', async () => {
        const fetchImpl = async () => new Response(JSON.stringify({ success: true, updatedCount: 0, timestamp: 't' }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
        });
        const result = await (0, index_js_1.touchLicenseSeat)({
            apiAuthBaseUrl: 'https://auth.example.com',
            accessToken: 'tok',
            fetchImpl,
        });
        strict_1.default.equal(result.updatedCount, 0);
        strict_1.default.equal((0, index_js_1.isLicenseSeatInactiveResult)(result), true);
    });
});
(0, node_test_1.describe)('LicenseTouchClient', () => {
    (0, node_test_1.it)('touches immediately on start and stops the timer', async () => {
        let hits = 0;
        const fetchImpl = async () => {
            hits += 1;
            return new Response(JSON.stringify({ success: true }), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            });
        };
        const client = new index_js_1.LicenseTouchClient({
            apiAuthBaseUrl: 'https://auth.example.com',
            getAccessToken: () => 'tok',
            intervalMs: 60_000,
            fetchImpl,
        });
        client.start();
        await new Promise((resolve) => setTimeout(resolve, 20));
        strict_1.default.equal(hits, 1);
        strict_1.default.equal(client.isRunning, true);
        client.stop();
        strict_1.default.equal(client.isRunning, false);
    });
    (0, node_test_1.it)('coalesces concurrent touch() into one HTTP call', async () => {
        let hits = 0;
        let release;
        const gate = new Promise((resolve) => {
            release = resolve;
        });
        const fetchImpl = async () => {
            hits += 1;
            await gate;
            return new Response(JSON.stringify({ success: true }), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            });
        };
        const client = new index_js_1.LicenseTouchClient({
            apiAuthBaseUrl: 'https://auth.example.com',
            getAccessToken: () => 'tok',
            fetchImpl,
        });
        const a = client.touch();
        const b = client.touch();
        release();
        await Promise.all([a, b]);
        strict_1.default.equal(hits, 1);
    });
});

# `@tubtimx/nexus-license-client`

Thin **license seat activity** client for TubtimX Nexus External Apps.

One renew contract for all app types (SPA, Nest BFF, softphone, CRM):

```text
OAuth login  → api-auth opens AgentSession (seat)
touch        → POST /sessions/heartbeat  (this package)
logout / TTL → seat released
```

`touch` = heartbeat = lease renew. Do **not** invent a second renew API.

## Packaging

Dual build for bundlers and Node:

| Condition | Entry |
|---|---|
| `import` (ESM) | `dist/esm/index.js` |
| `require` (CJS) | `dist/cjs/index.js` |
| TypeScript types | matching `dist/*/index.d.ts` |

```bash
pnpm run build   # cleans + ESM + CJS
pnpm test
```

## Install

From GitHub ([numpea00/nexus-license-client](https://github.com/numpea00/nexus-license-client)):

```bash
pnpm add github:numpea00/nexus-license-client
# or
pnpm add git+https://github.com/numpea00/nexus-license-client.git
```

Monorepo path (TubtimAuth checkout):

```bash
pnpm add @tubtimx/nexus-license-client@file:../packages/nexus-license-client
```

## Quick start (browser or Node)

```ts
import {
  LICENSE_TOUCH,
  LicenseTouchClient,
  isLicenseQuotaExceeded,
} from '@tubtimx/nexus-license-client';

const client = new LicenseTouchClient({
  apiAuthBaseUrl: process.env.API_AUTH_URL!, // e.g. https://auth.example.com
  getAccessToken: () => window.__tokens?.accessToken ?? null,
  intervalMs: LICENSE_TOUCH.RECOMMENDED_INTERVAL_MS, // 2 min
  onError: (err) => {
    if (isLicenseQuotaExceeded(err)) {
      // show "no seats available"
    }
  },
});

// After OAuth success:
client.start();

// On logout / unmount:
client.stop();
```

One-shot (e.g. after each important API call, or from a gateway plugin):

```ts
import { touchLicenseSeat } from '@tubtimx/nexus-license-client';

await touchLicenseSeat({
  apiAuthBaseUrl: 'https://auth.example.com',
  accessToken: accessToken,
});
```

## Rules

| Do | Don't |
|---|---|
| Use **External App** OAuth access token (`externalAppId` on JWT) | Use Nexus admin JWT — touch is a no-op for seats |
| Touch ≤ every **2 minutes** while in use | Assume login alone keeps the seat forever |
| Handle **429** `QUOTA_EXCEEDED` on OAuth seat open | Open AMI/ARI or a parallel license microservice |
| Prefer this package in every new External App | Copy-paste ad-hoc heartbeat URLs per service |

## Timers (api-auth)

| Constant | Value |
|---|---|
| `LICENSE_TOUCH.RECOMMENDED_INTERVAL_MS` | 2 minutes |
| `LICENSE_TOUCH.HIDDEN_INTERVAL_MS` | 1 minute (throttled tabs) |
| `LICENSE_TOUCH.ACTIVE_WINDOW_MS` | 5 minutes (counts as active) |
| `LICENSE_TOUCH.STALE_CLEANUP_MS` | 10 minutes (row closed) |

## Softphone reference

`softphone` uses this package for the HTTP touch; UI/auth lifecycle stays in `useHeartbeat`.

# Pulse End-to-End Tests

Chromium Playwright tests. Playwright starts its own server with `npx next dev -p 3100`. The suite uses a dedicated Neon test branch from `.env.test.local`. It must not reuse the development database in `.env`.

## Test Coverage

| File | Coverage |
|---|---|
| `gate.spec.ts` | T1 welcome screen shows Pulse, “Why are you here today?”, Help, and Enter Pulse; T2 denied location stays on the welcome screen |
| `presence.spec.ts` | T3 join shows my pin on the map; T4 two sessions see each other |
| `connect.spec.ts` | T5 request and accept a connection; T5b declining a request leaves both on the map; T6 leave conversation stays on the map |
| `chat.spec.ts` | T7 connected participants exchange chat messages |
| `departure.spec.ts` | T8 clean departure removes the other pin; T8 stale presence expires after polling stops |
| `privacy.spec.ts` | T9 public presence is offset 1–3 km from the true location |
| `video.spec.ts` | T10 connected participants render remote video |
| `ownership.spec.ts` | O1 poll, signal, and leave reject missing, invalid, or unknown secrets; O2 a session secret only authenticates its own presence |

## Test Support Files

| File | Responsibility |
|---|---|
| `fixtures.ts` | `pair` fixture with `enter()` and `connect()`. Cleanup POSTs `/api/leave` with `{ secret }` for each session, then closes both browser contexts. |
| `helpers.ts` | `GPS_A`, `GPS_B`, `enterPulse()`, `denyLocation()` |
| `isolate-db.ts` | Reads test `DATABASE_URL` only from `.env.test.local`. Requires a Neon (`.neon.tech`) Postgres URL and a valid `.env` development `DATABASE_URL` for identity comparison (hostname with `-pooler` stripped, port, database name). Matching identities are rejected. No fallback to `.env`. |

`playwright.config.ts` is at the repository root. It starts `npx next dev -p 3100` (`reuseExistingServer: false`) and sets that process’s `DATABASE_URL` to the validated test URL. `npm run dev` on port `3000` is unchanged.

## Test Environment

`.env` holds development `DATABASE_URL` and `NEXT_PUBLIC_MAPBOX_TOKEN` (map tests from T3 onward). `.env.test.local` is gitignored and holds the dedicated Neon test-branch `DATABASE_URL`. Do not copy `.env`.

```env
DATABASE_URL="YOUR_NEON_TEST_BRANCH_URL"
```

Push the Prisma schema to the test branch only. Prefixing `DATABASE_URL` is required so Prisma 7 does not load `.env`:

```bash
DATABASE_URL="YOUR_NEON_TEST_BRANCH_URL" npx prisma db push
```

## Run Tests

```bash
npx playwright install chromium
```

```bash
npm run test:e2e
```

```bash
npx playwright test
```

```bash
npx playwright test tests/e2e/ownership.spec.ts
```

## Debugging

```bash
npm run test:e2e:ui
```

```bash
npx playwright test tests/e2e/ownership.spec.ts --debug
```

```bash
npx playwright show-report
```

HTML report: `playwright-report/` (not opened automatically). Failure screenshots and traces: `test-results/`. Review traces before sharing; they may contain session credentials and network information.

## Notes

- Ownership tests use real API auth: poll and signal use Bearer; leave sends `{ secret }` in the JSON body.
- Mapbox and WebRTC are not stubbed: pins load on the real map, T7 uses the real chat data channel, and T10 uses the real `getUserMedia` / video panel. Chromium fake camera/microphone flags supply media. Locations use Playwright geolocation, not GPS hardware. T8 stale presence aborts `/api/poll` so the other session can go stale.
- Fixtures create isolated browser contexts and clean up only sessions created by that test.
- Locations are synthetic. Physical devices and cross-network WebRTC are outside this suite.

## References

- [Next.js Playwright testing](https://nextjs.org/docs/app/guides/testing/playwright)
- [Playwright documentation](https://playwright.dev/docs/intro)

# P4-03 — Expo Go through the preview proxy (WANDIT-193)

Test date: 2026-09-26. Sandbox: Vercel Sandbox `cdg1`, vendor base image `vercel/sandbox/node:22` (no warm store), `V2_SANDBOX_EGRESS_MODE=strict`, template `mobile-app@1.0.0`.

## Result

- Sandbox and proxy part: **go**. Metro starts under strict egress with no hang. The manifest and the bundle name only the preview hosts.
- Real phones: **pending**. Zack runs the store Expo Go test below after the Worker deploy. Until then, the per-platform result is UNVERIFIED.

## Measurements

| Item | Value | Source |
|---|---|---|
| Expo SDK of the template | 57 (`expo@57.0.25`, `runtimeVersion: "exposdk:57.0.0"`) | `templates/mobile-app/package.json`, the manifest |
| Store Expo Go version | 57.0.9 | WANDIT-191 comment |
| Sandbox create with template init | 29 to 31 s | 3 runs, vendor base image |
| Metro `/status` ready after the dev command | 8 to 11 s | 3 runs |
| Manifest answer time | 87 to 95 ms | `expo-platform: ios`, `accept: application/expo+json` |
| Manifest formats | `application/expo+json`, and `multipart/mixed; boundary=----formdata-<id>` with one `manifest` part | Expo CLI 57 `ExpoGoManifestHandlerMiddleware` |
| First iOS dev bundle | 13,851,398 bytes, 47 to 51 s (cold Metro cache) | 2 runs |
| Vendor host in the bundle | 0 hits with `X-Forwarded-Host` set | 2 runs |
| Bytes of one 10-minute session | ESTIMATE 15 to 20 MB uncompressed: the first bundle, lazy route chunks, and Fast Refresh updates | bundle size above |
| Egress cost of one session | ESTIMATE $0.003 at $0.15 per GB (`iad1` price, UNVERIFIED for `cdg1`) | issue text |

Strict egress: `expo start` did not wait on Expo hosts. The template has no `extra.eas.projectId`, so Expo CLI skips the development code-signing call. `EXPO_OFFLINE=1` is not necessary, and `api.expo.dev` stays off the allow list (WANDIT-283).

## URL form

- Metro host in every manifest URL: `https://p-<projectId>.<PREVIEW_DOMAIN>`, from `EXPO_PACKAGER_PROXY_URL` in the dev command env. Expo CLI writes no `:443` port. The Worker serves nothing on this host.
- Phone host: `m-<phoneId>--p-<projectId>.<PREVIEW_DOMAIN>`. `phoneId` is 13 random bytes in lower-case base32, 21 characters. The label has 63 characters, the DNS limit, so the wildcard certificate covers it.
- Expo Go URL: `exps://m-<phoneId>--p-<projectId>.<PREVIEW_DOMAIN>`. UNVERIFIED: whether the store Expo Go opens `exps://` from the camera QR on both platforms.
- Manifest fields that name the host: `launchAsset.url`, `extra.expoClient.hostUri`, `extra.expoGo.debuggerHost`, and the asset URLs under `/assets/`.

## Path list

The Worker forwards every path on a phone host. These paths come from Expo CLI 57 and the manifest of the test run:

| Path | Use |
|---|---|
| `/`, `/manifest`, `/index.exp` | Manifest (with `expo-platform`). `/` without it gives the Expo web HTML. |
| `/node_modules/expo-router/entry.bundle?platform=<ios or android>&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.bytecode=1&transform.routerRoot=src%2Fapp&unstable_transformProfile=hermes-stable` | Bundle |
| `/node_modules/expo-router/entry.map?...` | Source map |
| `/assets/...` | Assets |
| `/symbolicate`, `/logs`, `/status` | Metro HTTP routes |
| `/hot`, `/message` | Metro WebSockets (Fast Refresh, dev menu) |

## Phone link

| Item | Value |
|---|---|
| Phone link life | 60 minutes (`PHONE_LINK_TTL_SECONDS`). Zack chose it on 2026-09-26: Expo Go takes no cookie, so a 15-minute link breaks Fast Refresh. See D4 in `docs/v2/DECISIONS.md`. |
| iframe token life | 15 minutes, unchanged |
| Rate limit | 600 requests per minute per phone link `jti` |
| New link | On each open of the QR panel |
| iPhone username | The Worker writes `extra.expoGo.username` from the signed `expoUsername` claim. The manifest of the sandbox has no username, because Expo CLI there has no login. |

## Manual test (Zack)

1. Deploy the Worker (`cd apps/preview-proxy && npx wrangler deploy`). Staging has no preview route, so test on the live preview domain.
2. Create a mobile project. Check the phone frame, the iOS/Android toggle, the reload, and Fast Refresh after a turn.
3. Android, store Expo Go: scan the QR. Record whether the app opens and whether Fast Refresh works.
4. iPhone, store Expo Go signed in as `X`: type `X` in the panel, scan, and record the result. Then type a wrong name, scan, and record the Expo Go error.
5. Fetch one bundle through the phone host and search it for `vercel.run`. UNVERIFIED: whether Cloudflare and the Vercel edge pass `X-Forwarded-Host` unchanged.
6. Read the `wandit_preview_proxy` Analytics Engine data for the bytes of one 10-minute session.

| Platform | Opens | Fast Refresh | Bytes of 10 minutes | Note |
|---|---|---|---|---|
| Android, store Expo Go 57 | pending | pending | pending | |
| iPhone, store Expo Go 57, right username | pending | pending | pending | |
| iPhone, wrong username | pending | not applicable | not applicable | Expect the Expo Go mismatch error. |

Fallback when a phone cannot load the app: the panel tells the user to use an Android phone. The stable path is the wandit preview app (WANDIT-195), or the Appetize device in the browser (WANDIT-196).

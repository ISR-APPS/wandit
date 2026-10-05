# P5-02 — Appetize device preview with the store Expo Go (WANDIT-196)

Date: 2026-09-26. Scope: the rescope of Zack on WANDIT-196 (the store Expo Go builds on Appetize, the same path as Expo Snack; no wandit preview app).

## Result

- Code: **built**. Upload script, `device_sessions` table, start and end routes, minutes task, and web device panel. See "What the code does".
- Appetize test: **pending**. No Appetize account exists yet. The main question stays UNVERIFIED: does an Appetize device open `exps://m-<id>--p-<pid>.<PREVIEW_DOMAIN>` and load the Metro bundle through the preview proxy? Zack runs the test below before the feature flag goes on.

## Facts checked

| Item | Value | Source |
|---|---|---|
| iOS build | `Expo-Go-57.0.9.tar.gz`, 143,359,419 bytes | `https://exp.host/--/api/v2/versions`, download of 2026-09-26 |
| iOS archive layout | The `.app` contents at the root, no `.app` folder. The repack into `Exponent.app/` gives `CFBundleIdentifier` `host.exp.Exponent` and `CFBundleSupportedPlatforms` `iPhoneSimulator`. | local repack, 2026-09-26 |
| Android build | `Expo-Go-57.0.9.apk`, uploaded as is | versions endpoint |
| iOS devices for Expo Go 57 | Appetize iOS 17.2, 18.2, 26.0 only | Zack comment |
| Devices in the code | `iphone15pro` on iOS 17.2, `pixel8` on Android 14.0 (the labels of the top bar) | Appetize device list, 2026-09-26 |
| Upload API | `POST /v1/apps` (new) and `POST /v1/apps/{publicKey}` (update, same key), multipart `file` or JSON `url` | Appetize docs |
| Session log API | `GET /v2/sessions?sessionToken=&startDate=`; `startDate` is required; `closeTime` is null until the session closes | Appetize docs |
| Session limits in the code | time limit 900 s, idle timeout 120 s | `domain/device-minutes.ts` |
| Price | Starter $59 per month, 500 minutes, 3 devices; $0.06 per extra minute (PLAUSIBLE, not checked on the pricing page) | issue text |

## What the code does

1. `pnpm appetize:upload-expo-go` (in `apps/server`) reads the versions endpoint, downloads the SDK 57 builds, repacks the iOS build, and uploads each build once per version. The Appetize `note` holds `expo-go:<version>`, so a second run skips the upload. Each run writes `timeout` 120, `timeLimit` 900, `maxConcurrent`, and `referrerHostnamesRestricted`. A new app prints its key for `APPETIZE_IOS_PUBLIC_KEY` or `APPETIZE_ANDROID_PUBLIC_KEY`.
2. `POST /api/v2/projects/:id/device-sessions {platform}` checks the V2 mobile project, the month minutes of the payer (Free 0, Pro 60, Business 180, ESTIMATE), and one open session per user (Redis `SET NX PX` on `mobile_preview:user:{userId}`). It mints a 60-minute phone link (WANDIT-193) and checks Metro `/status` through it. Then it answers the Appetize config with `launchUrl: "exps://<phone host>"`.
3. `POST .../device-sessions/:id/end {appetizeSessionToken?}` stores the Appetize token and frees the lock.
4. The `device-minutes` task (every 5 minutes) bills each ended row once. It uses `closeTime - startTime` from Appetize, rounded up to whole minutes. Without a token, or without a closed Appetize log after one hour, it bills the own clock (capped at 15 minutes). It writes one `mobile_preview` usage row at zero credits with one `appetize` evidence row at $0.06 per minute.
5. The web panel (behind the PostHog flag `v2-device-preview`) starts on a button only, shows the queue place, a countdown, reload, the dev menu, and stop, sends heartbeats while the tab is visible, and ends the session on unmount.

## Manual test (Zack)

1. Create an Appetize account (Starter at least; Premium for an event). Create an API token and set `APPETIZE_API_TOKEN` in the server and Trigger.dev env. Never paste it in chat.
2. Add the wandit web hosts in Embed Domains. Set Session Defaults: a 15-minute limit and a 2-minute idle timeout. Set usage alerts.
3. Run `pnpm appetize:upload-expo-go` from `apps/server`. Set the two printed keys in the server env.
4. Deploy the preview Worker (WANDIT-193) and run `pnpm db:migrate` (migration `0081_device-sessions`).
5. Turn on `v2-device-preview` for your user. Open a mobile project, press "Run on a device", and record the rows below.
6. After one day, compare the `mobile_preview` minutes in `ai_usage_events` with the Appetize dashboard. The target is 5 percent.

| Platform | Device opens the app | Fast Refresh after a turn | Seconds to the first frame | Note |
|---|---|---|---|---|
| iOS 17.2, `iphone15pro` | pending | pending | pending | |
| Android 14.0, `pixel8` | pending | pending | pending | |

If the device cannot reach the preview proxy, the fallbacks of the description apply: the Appetize `proxy` option, or a public Metro host without a token. The second one weakens the preview security rule (report 8.2 item 7), so Zack must approve it first.

## Open

- Terms: the Expo name and logo are trademarks. Expo Go is MIT, and no Expo or Appetize term forbids the upload. Expo Snack is a product of Expo, so it is no precedent for a third party. Optional: ask Expo for a written OK.
- `starter` is the plan of a user with no subscription and also a paid retention plan. Both get 0 minutes today. Zack decides.

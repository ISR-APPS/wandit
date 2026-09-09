# V2 research: generate and preview Expo mobile apps from the wandit builder

Date: 2026-09-03
Worktree read: `/Users/mac/Desktop/work/projects/ISR-AI/.claude/worktrees/v2-builder` (branch `feat/v2-builder`, same as `dev`)
Author: Claude Fable subagent (read-only research; no source edits, no commits)

Repo paths are relative to the worktree root. Line numbers are from the files as read on 2026-09-03.
Web facts come from pages fetched on 2026-09-03. Items marked **UNVERIFIED** were not confirmed from a primary source.
Items marked **OLD** come from sources older than 12 months.

Note on method: the session's web-search budget was used up before this task started. All web evidence below comes from direct fetches of known URLs (official docs, pricing pages, GitHub repos). Where a page did not load or hid its numbers behind scripts, the item is marked UNVERIFIED.

---

## 0. Short answers

1. **Every mobile builder on the market previews Expo apps in one of two ways: React Native Web in the browser, or Expo Go / a custom preview app on the user's phone by QR code.** Nobody streams a cloud simulator as the main preview. Expo's own Snack does stream iOS and Android devices in the browser, and it uses Appetize.io for that (see 4.1).
2. **Phase 1 (cheapest viable preview)** needs no new infrastructure: run `npx expo start --web` in the same sandbox that serves web previews and show it in the existing iframe; encode the sandbox's public Metro URL in a QR code so the user can open the app in Expo Go. Extra cost: zero beyond sandbox time.
3. **Phase 1.5 (device look in the browser, on demand)** is Appetize.io: build one custom dev client per project (EAS Build, $2 iOS / $1 Android after the free 15+15 builds per month), upload the simulator `.app` or `.apk` once, embed `https://appetize.io/embed/{buildId}` in an iframe, and let the dev client load JavaScript from the sandbox's Metro. Appetize costs $59 per month for 500 minutes and 3 concurrent devices, then $0.06 per minute. This is what Expo Snack does.
4. **Phase 2 (real device or simulator streaming that wandit owns)** splits by platform. Android: self-host emulators on KVM-capable Linux (bare metal, or GCP/Azure with nested virtualization) with WebRTC streaming; software is open source. iOS: simulators need macOS. Rent Mac minis (Scaleway from EUR 0.22/hour, MacStadium from $149/month, AWS `mac-m4.metal` about $1.23/hour, all with a 24-hour minimum) and stream simulators with `serve-sim` (Apache-2.0, MJPEG or H.264 over WebSocket). Apple's licence allows only 2 macOS VMs per host, so the practical design runs simulators directly on the host, not in VMs.
5. **Building and shipping** is solved by EAS and is already used in this repo (`apps/native/eas.json`, `.github/workflows/mobile-testflight.yml`). Users need an Apple Developer Program account ($99 per year) and a Google Play developer account ($25 one time, plus a 12-tester, 14-day closed test for new personal accounts).
6. The biggest hidden constraint is **Expo Go SDK drift**: the App Store Expo Go build lags Expo SDK releases by months (SDK 54 was the store build until at least May 2026). Generated projects must pin the SDK that the store Expo Go supports, or wandit must ship its own preview app.

---

## 1. What the repo already has

| Item | Evidence |
|---|---|
| Expo SDK 56, React Native 0.85.3, react-native-web 0.21, expo-router 56 | `apps/native/package.json:35,49,60,68` |
| AI SDK `ai ^7.0.14` in the native client (same family as the server) | `apps/native/package.json:31` |
| EAS profiles `development` and `preview` with `distribution: internal`; `staging` and `production` profiles | `apps/native/eas.json:7-12` |
| CI runs `eas build --platform ios --profile <staging|production> --non-interactive --no-wait --auto-submit` on push | `.github/workflows/mobile-testflight.yml:59` |
| The native app previews **static HTML only**, in a `react-native-webview`. No infrastructure for previewing user-generated Expo apps exists. | `docs/v2/research/inspect-native-and-simulator.md` section 0 and 2.6 |
| The V2 sandbox recommendation is Vercel Sandbox (Firecracker microVM), with E2B as fallback | `docs/v2/research/sandboxes.md:326-351` |
| The AI SDK harness only ships a Vercel Sandbox adapter | `docs/v2/research/ai-sdk-harness.md:16` |
| Metro in a cloud sandbox: `EXPO_PACKAGER_PROXY_URL` forces the URL the phone opens; `--tunnel` is not needed when the sandbox exposes the port | `docs/v2/research/sandboxes.md:296-301` |
| Simulator or emulator streaming cannot run inside these sandboxes (no macOS, no nested KVM) | `docs/v2/research/sandboxes.md:301` |

Consequence: `apps/native` gives V2 a mobile *client*. Nothing in the repo previews *generated* mobile apps. All of that is new work.

---

## 2. Expo platform facts that shape the design (2026)

### 2.1 SDK releases

| SDK | Date | React Native | Notes | Source |
|---|---|---|---|---|
| 55 | 2026-02-25 | 0.83 | Legacy Architecture removed. Node `^20.19.4`, `^22.13.0`, `^24.3.0`, `^25.0.0`. `eas update` needs `--environment`. New `eas go` command builds a personal Expo Go. Expo Go on the stores stayed on SDK 54. | https://expo.dev/changelog/sdk-55 |
| 56 | 2026-05-21 | 0.85 | Hermes v1 default. Node >= 20.19.4. Expo UI production-ready. Expo Router independent from React Navigation, with streaming SSR on web. "Expo Go for SDK 56 is not available on the Apple App Store or Google Play Store." | https://expo.dev/changelog/sdk-56 |
| 57 | 2026-06-30 | 0.86 | New Expo Go "pending App Store / Play Store approval" at release. Reanimated 4.5, Gesture Handler 2.32. | https://expo.dev/changelog/sdk-57 |

EAS Build workers (image `sdk-57`): Android on GCP `n2-standard-4` (medium) or `n2-standard-8` (large), Ubuntu 26.04, Node 22.23.1; iOS medium = 5 performance cores, 20 GiB RAM, macOS Tahoe 26.5.2, Xcode 26.6. https://docs.expo.dev/build-reference/infrastructure/

### 2.2 Expo Go in 2026: a moving target

- 2026-05-04: "Expo Go for SDK 55 remained pending approval on Apple's App Store." SDK 54 stayed the store build. Expo re-framed Expo Go as "an educational tool to help beginners". From SDK 56, `create-expo-app` asks whether the user wants App Store compatibility (older SDK) or the latest SDK. https://expo.dev/changelog/expo-go-and-app-store-may-2026
- 2026-05-12: Expo Go can "only load projects that you own or that are owned by an organization you are a member of" **when loading EAS Update**. Hermes bytecode in Expo Go is limited to EAS Update; self-hosted updates must serve plain JS. https://expo.dev/changelog/expo-go-loading-changes-may-2026
  - This rule targets EAS Update URLs. Loading a local or remote **dev server** (`exp://host:port`) is not named in the rule. UNVERIFIED that dev-server loading stays unrestricted forever.
- Today (2026-09-03) https://expo.dev/go lists "SDK 57 (latest)" for Android, iOS, Android Emulator and iOS Simulator downloads. Whether the App Store binary is SDK 57 is UNVERIFIED (the page does not separate store builds from direct downloads).
- Expo Go cannot run custom native code; a development build (`expo-dev-client`) is "your own custom version of Expo Go". https://docs.expo.dev/develop/development-builds/introduction/
- EAS Update previews cannot be opened in Expo Go; they need a development build, Expo Orbit, or the Updates API. https://docs.expo.dev/eas-update/getting-started/
- Expo's review docs say: "Expo Go is a playground for students and learners, not for building production-grade projects." https://docs.expo.dev/review/overview/

Design consequence: a builder that depends on the store Expo Go must pin generated projects to the SDK that store Expo Go runs, and must re-pin when the store build moves. a0.dev already does this (it tells Android users to install "version 52" of Expo Go, see 4.4).

### 2.3 Expo CLI, tunnels, and remote Metro

- `npx expo start --tunnel` needs `npm i -g @expo/ngrok` and creates URLs like `https://xxxxxxx.bacon.19000.exp.direct:80`. Limits: slower, public URL (entropy added), needs internet on both ends, depends on ngrok uptime. https://docs.expo.dev/more/expo-cli/
- `EXPO_PACKAGER_PROXY_URL=<public URL>` forces the URL that Expo CLI puts in the QR code and manifest. That is the right tool when the sandbox already exposes port 8081 on a public hostname. https://docs.expo.dev/more/expo-cli/
- There is no product called "EAS tunnel". UNVERIFIED that Expo sells any hosted tunnel.
- Expo web: `npx expo start --web`, React Native for Web wraps `react-dom` primitives, Metro bundles for web, `npx expo export --platform web` for static output. "Native modules are unavailable on web." https://docs.expo.dev/workflow/web/

### 2.4 EAS pricing (https://expo.dev/pricing)

| Item | Price |
|---|---|
| Plans | Free $0; Starter $19/month + usage; Production $199/month + usage; Enterprise custom |
| Free builds | 15 Android + 15 iOS per month |
| Build price after free tier | Android medium $1, large $2; iOS medium $2, large $4 |
| EAS Update MAU | Free 1K; Starter 3K then $0.005/MAU; Production 50K then $0.005/MAU; Enterprise 1M+ then $0.00208333/MAU |
| EAS Workflows | Linux medium $0.018/minute; macOS large $0.150/minute (beyond included minutes) |

Build caching: compiler cache free for all users since 2026-01-26; Gradle cache since 2026-04-30 (https://expo.dev/changelog). SDK 56 precompiled iOS modules cut median clean iOS build time by about 1 minute (about 16%) (https://expo.dev/changelog/sdk-56). Wall-clock time per EAS build is not published; from the repo's own TestFlight pipeline, expect 10-25 minutes for iOS. UNVERIFIED.

### 2.5 EAS Build outputs that matter for preview

- iOS simulator build: set `"ios": { "simulator": true }` in an `eas.json` profile, then `eas build -p ios --profile <name>`. Output installs on the Simulator via the CLI or `eas build:run -p ios`. https://docs.expo.dev/build-reference/simulators/
- Internal distribution (iOS ad hoc): profile lists device UDIDs; "at most 100 iPhones per year"; register with `eas device:create`; new devices can take 24-72 hours at Apple. Install URLs are public 32-character UUID links unless Expo login is required. Android: plain APK link. https://docs.expo.dev/build/internal-distribution/
- Preview links: `eas update --auto` gives an EAS dashboard link; reviewers click "Preview" and scan a QR. Workflows can publish previews on every commit via `.eas/workflows/publish-preview-update.yml`. https://docs.expo.dev/review/share-previews-with-your-team/
- EAS Workflows: YAML in `.eas/workflows/*.yml`; job types `build`, `update`, `submit`, `slack`, Maestro tests; triggers: manual `eas workflow:run`, GitHub push, App Store Connect events. https://docs.expo.dev/eas/workflows/get-started/ . EAS Workflows added iOS device registration automation on 2026-06-15 (https://expo.dev/changelog/eas-internal-ios-ci-workflows).
- Expo Orbit: desktop app (macOS, Windows, Linux) that installs EAS builds, updates and Snacks into simulators and devices. Needs Android SDK and, on macOS, `xcrun`. https://docs.expo.dev/build/orbit/ . Repo: https://github.com/expo/orbit (872 stars, pushed 2026-09-01).

### 2.6 Store accounts

- Apple Developer Program: $99 per year; TestFlight up to 10,000 external testers; Enterprise Program $299 per year. https://developer.apple.com/programs/
- Google Play: US$25 one-time fee; identity and device verification for personal accounts. https://support.google.com/googleplay/android-developer/answer/6112435
- Personal Play accounts created after 2023-11-13 must run a closed test with "a minimum of 12 testers who have been opted in continuously for at least 14 days" before production access. https://support.google.com/googleplay/android-developer/answer/14151465
- Non-technical users therefore cannot "publish to the stores" on day one. Plan an "Install on your phone" path (internal distribution APK, TestFlight) before the store path.

---

## 3. Preview options and their real constraints

### 3.1 Option 1: Expo web (react-native-web) in an iframe from the sandbox

How: the harness scaffolds the Expo project in the sandbox, runs `npx expo start --web` on an exposed port, and the web builder shows the URL in the same iframe path as web apps. The Vercel Sandbox exposes ports on a public URL (`docs/v2/research/sandboxes.md:48`).

Pros:
- Zero extra services; same preview plumbing as web apps; Fast Refresh; console and network visible in DevTools.
- Every competitor with a browser preview does this (Bolt, a0.dev, Rork; see section 4).
- Expo SDK libraries "are built to support both browser and server rendering environments" (https://docs.expo.dev/workflow/web/).

Cons and constraints:
- "Native modules are unavailable on web." Camera, biometrics, push, native SwiftUI/Compose views, in-app purchases do not render (https://docs.expo.dev/workflow/web/; a0.dev lists the same limits: https://docs.a0.dev/development/testing/web-preview.md).
- Styling differs from native (a0.dev docs: "some features that work on mobile may behave differently or not work in the web preview").
- Expo UI (SwiftUI / Jetpack Compose) renders only its "Universal" tier on web (https://docs.expo.dev/versions/latest/sdk/ui/). The generator must avoid platform-only components or wrap them in `Platform.select`.
- Iframe sizing must fake a phone frame (a CSS device bezel at 390x844). This is cosmetic only.

Cost: sandbox time only (Vercel Sandbox roughly $0.09 idle to $0.34 per hour at full CPU, `docs/v2/research/sandboxes.md:48`).

### 3.2 Option 2: Expo Go on the user's phone via QR from the cloud sandbox

How: Metro runs in the sandbox on port 8081. Set `EXPO_PACKAGER_PROXY_URL` to the sandbox's public HTTPS URL so the QR encodes that URL. The user scans it with Expo Go (or the camera app on iOS).

Pros:
- Real device rendering, real touch, real native modules that ship inside Expo Go.
- No build step; Fast Refresh over the network.
- This is the path Bolt, Replit, Rork Pro, a0.dev (Android) and Vibecode use (section 4).

Cons and constraints:
- **SDK pinning**: the store Expo Go runs one SDK. It was SDK 54 from Feb 2026 to at least May 2026. Generated projects must match, or the phone shows an SDK-mismatch error. expo.dev/go says SDK 57 today; confirm the store build before choosing the template SDK.
- **No custom native code**: any library with native code outside Expo Go fails. The generator must be restricted to the Expo Go module set, or the product must move to a dev client (3.2b).
- **Network**: the phone must reach the sandbox URL. The Vercel Sandbox URL is public without a token (`docs/v2/research/sandboxes.md:48`), so this works, but the URL leaks the project. Use short-lived signed URLs through the wandit edge proxy (`docs/v2/research/sandboxes.md:294`). Expo CLI's manifest and bundle requests are plain HTTP(S) + WebSocket for HMR; the proxy must pass WebSockets.
- **Tunnels**: `--tunnel` (ngrok) is only needed when the dev server has no public address. In a sandbox with a public port it is unnecessary and slower. Third-party tunnels add another dependency and public URL.
- **Expo Go policy risk**: Expo now restricts EAS Update loading to owned projects and calls Expo Go an educational tool. Dev-server loading still works, but the direction is clear: Expo wants builders on development builds.
- **Auth**: Google sign-in in a user's generated app cannot round-trip inside Expo Go because custom schemes are not registered (the repo hit this exact problem in its own app: `apps/native/lib/dev-auth-bypass.ts`, see `docs/v2/research/inspect-native-and-simulator.md` 2.3). Generated apps that need OAuth need a dev client.

**Option 2b: wandit preview app (a dev client) instead of Expo Go.** Build one `expo-dev-client` app per "runtime" (a fixed set of native modules), ship it to TestFlight / internal distribution / Play internal testing, and let users open QR codes with it. This is what a0.dev (iOS "a0 app") and Vibecode do. Cost: one EAS build per runtime change plus a wandit Apple/Google developer account (already exists: `apps/native/app.json` has the EAS project id and `ascAppId 6804269467` per `inspect-native-and-simulator.md` 2.1). Limits: TestFlight external testers 10,000; ad hoc devices 100 per year (so use TestFlight, not ad hoc). Time to get a user onto the preview app: TestFlight install takes minutes; App Store listing of a preview app takes review.

### 3.3 Option 3: hosted device or simulator streaming services

#### Appetize.io (best fit for a product embed)

- Pricing (fetched via a render proxy from https://appetize.io/pricing on 2026-09-03; the raw page hides the table behind scripts, so treat as PLAUSIBLE, not fully verified):
  - Free: $0, 30 session minutes per month, 2 concurrent devices, throttled.
  - Starter: $59/month (or $708/year), 500 minutes per month, then $0.06/minute, 3 concurrent devices.
  - Premium: $319/month (or $3,828/year), 500 minutes per month, then $0.06/minute, 16 concurrent devices.
  - Enterprise: custom; "Per User or Metered billing", private cloud or self-hosting.
- Upload API: `POST https://api.appetize.io/v1/apps` with `X-API-KEY`; fields `platform` (ios|android), `url` (link to `.zip`, `.tar.gz` or `.apk`), `fileType`, `timeout` (30 to 7200 s, default 120), `timeLimit` (max session seconds), `maxConcurrent`, `referrerHostnamesRestricted`, `launchUrl`, `appPermissions`. Returns `publicKey`. https://docs.appetize.io/rest-api/v1/create-new-app.md
- iOS upload format: **simulator builds only** (`.app` zipped or tar.gz); "AppStore device builds (.ipa) are not supported"; ARM simulator builds recommended. https://docs.appetize.io/platform/app-management/uploading-apps/ios.md . EAS Build produces exactly this with `ios.simulator: true` (2.5).
- Embed: `<iframe src="https://appetize.io/embed/{buildId}">` plus query params, or JS SDK `<script src="https://js.appetize.io/embed.js">`, `window.appetize.getClient("#appetize")`, `client.startSession()`. https://docs.appetize.io/platform/embedding-apps.md ; https://docs.appetize.io/javascript-sdk.md
- Config options include `device`, `osVersion`, `scale`, `launchUrl`, `params`, `proxy`, `codec` (`h264` default, `jpeg` fallback), `region` (`us` | `eu`), `enableAdb`, `grantPermissions`, `appearance`, `location`, `userInteractionDisabled`. https://docs.appetize.io/javascript-sdk/configuration.md
- Devices: iPhone 8 to iPhone 17 Pro Max, iOS 15.5 to 26.0; Android Nexus 5 to Pixel 9 XL, Android 8.1 to 16.0. iOS devices are simulators, not real hardware. https://docs.appetize.io/features/devices-and-os-versions.md
- Session inactivity timeout default 2 minutes; configurable per organisation or build. https://docs.appetize.io/platform/session-inactivity-timeout.md
- Queueing: the JS client emits `queue` events with `position` when concurrency is exhausted; Expo Snack logs this as `QUEUED_FOR_PREVIEW` (https://raw.githubusercontent.com/expo/snack/main/website/src/client/components/DevicePreview/AppetizeFrame.tsx).
- Proof of fit: **Expo Snack uses Appetize** for its in-browser iOS/Android device preview (same file). Snack's `platform` query parameter accepts `ios`, `android`, `web`, `mydevice`; the default is `web` (https://raw.githubusercontent.com/expo/snack/main/docs/url-query-parameters.md).
- Pattern that avoids a rebuild per edit: upload a **dev client** build once, and pass the sandbox Metro URL through `launchUrl` or `params` so the dev client loads the live bundle. Snack does the same with its runtime app. UNVERIFIED that Appetize devices can reach an arbitrary public HTTPS host; the `proxy` option and network permissions suggest outbound access is normal.

#### BrowserStack App Live

- Pricing (via render proxy, PLAUSIBLE): Freelancer $19/month (100 minutes), Individual $39/month (1 user, 1 parallel), Team $150/month (5 users, 1 parallel), Team Pro $249/month (5 users, 4 parallel), Enterprise custom. https://www.browserstack.com/pricing?product=app-live
- Real iOS and Android hardware, 30,000+ device units. No public API or SDK to embed interactive sessions into a third-party product for end users was found on the product page. https://www.browserstack.com/app-live
- Verdict: a QA tool for wandit's own team, not a preview surface for wandit users.

#### LambdaTest (now "TestMu AI")

- https://www.lambdatest.com/pricing redirects to https://www.testmuai.com/pricing/ ("TestMu AI (Formerly LambdaTest)"). Real Device Plus Live: $39/month billed annually; parallels configurable 1 to 10+. REST APIs are for automation pipelines; no documented end-user embed.
- Verdict: same as BrowserStack. Not a product embed.

#### Corellium

- Virtual iOS and Android devices on Arm hardware with browser UI, CLI and API. Audience: security teams, government, OEMs, researchers. The site footer links to Cellebrite (`cellebrite.com/en/products/corellium/...`); ownership by Cellebrite is PLAUSIBLE but not stated on the page. Pricing not public; `/pricing` redirects to a Cellebrite trial page. https://www.corellium.com/
- Verdict: wrong audience, wrong licence position (Apple litigated Corellium over iOS virtualisation; OLD, UNVERIFIED for current terms). Do not build a consumer preview on it.

#### Genymotion SaaS (Android only)

- Pay-as-you-go $0.06 per minute per running virtual device; Unlimited plan $219/month ($179/month annual); Device Image on AWS/GCP/Azure marketplaces $0.60 per hour per instance plus cloud fees. https://www.genymotion.com/pricing/
- Embeddable web player: `genymotion-device-web-player` (MIT, 150 stars, pushed 2026-07-03) streams WebRTC at 30+ fps up to 1920x1080; SaaS token comes from `POST /v1/instances/access-token`. https://github.com/Genymobile/genymotion-device-web-player
- Verdict: a credible managed Android option with a real embed SDK, at the same per-minute price as Appetize, but Android only.

### 3.4 Option 4: self-hosted Android emulator in Linux with WebRTC or scrcpy streaming

Software choices:

| Project | What it is | KVM needed | Streaming | Status (GitHub API, 2026-09-03) |
|---|---|---|---|---|
| google/android-emulator-container-scripts | Google's Docker images of the official emulator, with a Python gateway to the emulator's gRPC and a React/Vite WebRTC frontend | Yes: "KVM must be enabled on your host... bare-metal Linux or inside cloud Virtual Machines with nested virtualization enabled." Nested = reduced performance. | WebRTC | Apache-2.0, 2,077 stars, pushed 2026-07-24, "experimental". Images named `{api}-{sort}-{abi}` e.g. `34-playstore-x64:36.5.11`. https://github.com/google/android-emulator-container-scripts |
| remote-android/redroid | Android userspace in a container (no emulator). Needs `binder_linux`, `hwbinder`, `vndbinder`, `ashmem_linux` kernel modules. Android 8.1 to 16. GPU modes guest/host/auto. | **No KVM** (it is a container, not a VM) | ADB 5555 + scrcpy; you add ws-scrcpy or WebRTC yourself | No licence field, 6,763 stars, pushed 2026-05-17. https://github.com/remote-android/redroid-doc |
| budtmo/docker-android | Emulator in Docker with noVNC web view (`WEB_VNC=true`, port 6080), Android 9 to 14, Genymotion and MCP variants, "PRO version" upsell | Yes (`kvm-ok`) | noVNC (slow, no audio) | 15,806 stars, pushed 2026-09-02. https://github.com/budtmo/docker-android |
| Genymotion Device Image (marketplace) | Managed image on AWS/GCP/Azure at $0.60/hour + cloud | Runs on cloud VMs with nested virt or bare metal (UNVERIFIED which) | WebRTC via the MIT web player | https://www.genymotion.com/pricing/ |

Where KVM exists:

| Provider | KVM / nested virtualization | Source |
|---|---|---|
| Vercel Sandbox, E2B, Fly, CodeSandbox (Firecracker guests) | No `/dev/kvm` documented inside guests; Vercel documents Docker, VPN and FUSE with `sudo`, not nested VMs. Treat as **not available** (INFERENCE). | https://vercel.com/docs/sandbox/concepts |
| AWS EC2 | KVM only on `.metal` instance types | Firecracker getting-started, cited in `docs/v2/research/sandboxes.md:266` |
| Google Compute Engine | Nested virtualization on Intel-based N1/N2/C2/C3 and AMD N4D; not on E2, memory-optimised, Arm, or other AMD types; only Linux KVM as L1; "10% or greater" CPU penalty | https://docs.cloud.google.com/compute/docs/instances/nested-virtualization/overview |
| Azure | Dv5/Dsv5 series: "Nested Virtualization: Supported" | https://learn.microsoft.com/en-us/azure/virtual-machines/sizes/general-purpose/dv5-series |
| Hetzner Cloud | "No, this is not possible on cloud server." Dedicated (bare-metal) servers have KVM by definition; AX-line prices load by script and were not captured (UNVERIFIED). | https://docs.hetzner.com/cloud/servers/faq/ ; https://www.hetzner.com/dedicated-rootserver/ |

Constraints:
- Emulator density: no published number. Plan 1 emulator per 2 vCPU and 4 GB RAM as a starting point (UNVERIFIED, engineering estimate).
- GPU: software rendering (SwiftShader) is slow for Reanimated-heavy UIs; host GPU passthrough is more work.
- Google Play system images carry the Android SDK licence; redistribution to end users inside a hosted product should be reviewed by counsel (UNVERIFIED which clause applies).
- WebRTC needs a TURN server for users behind strict NATs; Google's scripts include a TURN option (README, partial).
- Operational: image updates, ADB security ("do not expose ADB on public networks", redroid docs), per-tenant isolation, and warm pools all fall on wandit.

### 3.5 Option 5: iOS simulators need macOS

#### Apple's licence (macOS Sequoia SLA, fetched PDF)

- Section 2B(iii): "install, use and run up to two (2) additional copies or instances of the Apple Software ... within virtual operating system environments on each Apple-branded computer you own or control ... for purposes of: (a) software development; (b) testing during software development; (c) using macOS Server; or (d) personal, non-commercial use."
- Same section: virtualised copies may not be used "in connection with service bureau, time-sharing, terminal sharing, relay service or other similar types of services" except under Section 3.
- Section 3A: leasing is allowed only for "Permitted Developer Services" (CI, building, automated testing, developer tools); "each lease period must be for a minimum period of twenty-four (24) consecutive hours"; the lessee "must have sole and exclusive use and control" of the hardware; the lessor must notify Apple Developer Relations.
- Section 3D: for leased Macs, either the lessor or the lessee (not both) may run the two VMs; the lessor may virtualise one instance only as a provisioning tool.
- Source: https://www.apple.com/legal/sla/docs/macOSSequoia.pdf (fetched 2026-09-03; the Tahoe SLA is presumed the same, UNVERIFIED).

Design consequences:
- The 24-hour minimum applies to every cloud Mac (AWS, Scaleway both state it).
- Two macOS VMs per host is a hard ceiling. Multi-tenant isolation by VM therefore gives at most 2 tenants per Mac. The practical design runs **many simulators directly on one bare-metal macOS** (simulators are processes, not VMs) and isolates tenants at the process and network level. Streaming a simulator to wandit's own customers is closer to "terminal sharing" than to CI; get legal advice before Phase 2 iOS.

#### Mac hosting prices

| Provider | Offer | Price | Minimum | Source |
|---|---|---|---|---|
| Scaleway (Paris) | Mac mini M4 16 GB | EUR 0.22/hour (~EUR 149/month) | 24 hours ("Due to license constraints, the minimum lease for Apple silicon-as-a-Service is 24 hours"); "100% dedicated machine, with no hypervisor" | https://www.scaleway.com/en/pricing/apple-silicon/ ; https://www.scaleway.com/en/mac-mini-m4/ |
| Scaleway | Mac mini M4 32 GB / M4 Pro 64 GB | EUR 0.29/hour (EUR 199/month) / EUR 0.49/hour (EUR 335/month) | 24 hours | same |
| Scaleway | Mac mini M1 8 GB / M2 16 GB / M2 Pro | EUR 0.11 / 0.17 / 0.21 per hour | 24 hours | same |
| MacStadium | Bare-metal Mac mini M4.S (16 GB) $149/month; M4.M $249; M4.L (M4 Pro, 48 GB) $349; Mac Studio from $249 | Monthly prepay; M4 volume needs 3+ units on annual terms | https://www.macstadium.com/pricing |
| MacStadium Orka | macOS VM orchestration (REST API, Kubernetes) on AWS EC2 Macs, on-prem or private cloud | Contact sales; no public price | https://www.macstadium.com/orka |
| AWS EC2 | `mac2.metal` (M1, 16 GiB) $0.65/hour; `mac2-m2.metal` (M2, 24 GiB) $0.878/hour; `mac-m4.metal` (M4, 24 GiB) $1.23/hour (third-party price mirror, PLAUSIBLE) | Dedicated Host only; "minimum host allocation and billing duration of 24 hours" | https://instances.vantage.sh/aws/ec2/mac-m4.metal ; https://aws.amazon.com/ec2/dedicated-hosts/pricing/ ; https://aws.amazon.com/ec2/instance-types/mac/ |
| Hetzner | No Mac product found | | https://docs.hetzner.com/cloud/servers/faq/ (no macOS mention) |

#### macOS VM tooling on Apple Silicon

- Cirrus Labs Tart: `Virtualization.framework`, OCI images (`tart clone ghcr.io/cirruslabs/macos-tahoe-base:latest`), macOS 13+. Licence: free up to 100 CPU cores; Gold $12,000/year (500 cores), Platinum $36,000/year (3,000 cores), Diamond $12/core/year. Nested virtualisation only for Linux guests on M3/M4 with macOS 15+. https://github.com/cirruslabs/tart ; https://tart.run/licensing/ ; https://tart.run/faq/ . Note: the GitHub API returned `openai/tart` for the repo slug (redirect), 6,658 stars, pushed 2026-09-02; ownership change UNVERIFIED.
- trycua Lume (part of `trycua/cua`, MIT, 22,146 stars, pushed 2026-09-03): `lume create`, `lume run`, IPSW-based macOS VMs, `lumier` Docker-style interface. https://github.com/trycua/lume
- Scaleway documents running VMs on the hosted Mac mini with UTM. https://www.scaleway.com/en/docs/apple-silicon/how-to/setup-vm-with-utm/
- All of these hit the same 2-VM limit.

#### Streaming a simulator

- `serve-sim` (Evan Bacon, Apache-2.0, 2,746 stars, pushed 2026-08-29): a Swift helper captures the simulator framebuffer through `simctl io`, exposes MJPEG (or H.264 for WebCodecs browsers) plus a WebSocket control channel (tap, swipe, keyboard, rotate, hardware buttons, camera injection), and a React preview UI on port 3200. macOS + Apple Silicon only; Node 20+. Middleware mode plugs into Metro/Vite/Next and proxies stream and WebSockets through one port (`proxyHelpers: true`). Codec option notes "'mjpeg' (force software JPEG, e.g. on VMs without H.264 encode)". https://github.com/evanbacon/serve-sim . Already installed on this Mac as a Claude Code plugin (`docs/v2/research/inspect-native-and-simulator.md` section 0, item 3).
- Facebook `idb` (MIT, 5,309 stars, pushed 2026-09-03): `idb video-stream --format {h264|rbga|mjpeg|minicap} --fps N` writes to stdout for piping; needs macOS 15+ and Xcode 26+. https://github.com/facebook/idb ; https://fbidb.io/docs/commands/
- `xcrun simctl io <udid> recordVideo` is the underlying Apple tool both use (Apple man page not fetched; UNVERIFIED wording).
- WebRTC: neither tool ships WebRTC. Wrapping the H.264 stream in WebRTC (for lower latency and NAT traversal) is custom work; MJPEG/H.264 over WebSocket through the wandit edge proxy is enough for a first version.

Density: a Mac mini M4 with 16 GB can run several booted simulators; Expo's own iOS build workers use 5 performance cores and 20 GiB per build. Plan 3-4 concurrent streamed simulators per 16 GB host and 6-8 per 32-64 GB host (UNVERIFIED, engineering estimate).

---

## 4. What competitors use for mobile preview

| Builder | Browser preview | Phone preview | Simulator streaming | Build / ship | Source |
|---|---|---|---|---|---|
| Expo Snack (Expo's own) | React Native Web (default `platform=web`) | Expo Go QR (`mydevice`) | **Appetize.io** iOS + Android in the browser, with queue events | n/a | https://raw.githubusercontent.com/expo/snack/main/website/src/client/components/DevicePreview/AppetizeFrame.tsx ; docs/url-query-parameters.md |
| Bolt.new | WebContainers in the browser; `npx expo export --platform web` for web output | Expo Go QR from the "Device Preview" icon | None | `eas build --platform ios --auto-submit`; Android AAB manual upload; "first time ... will take some time to build" | https://support.bolt.new/integrations/expo |
| Rork | Web preview (INFERENCE: RN Web) | Rork Pro: Expo Go QR. Rork Max (SwiftUI): browser installer over WebUSB in Chrome/Edge on a Mac, or "Rork Companion" app over USB | None | Rork Max: two-click cloud compile and App Store submit; Pro: Expo account + EAS; plans $25 to $200+/month | https://rork.com/faq |
| a0.dev | react-native-web web preview with hot reload; no native features | One QR for both platforms: iOS "a0 app" from the App Store (their own dev client); Android uses "version 52" of Expo Go | None | One-click publishing: "We'll handle the build, create your App Store Connect listing, and upload it for you." | https://docs.a0.dev/development/testing/web-preview.md ; https://docs.a0.dev/development/testing/mobile-app-testing.md ; https://a0.dev/ |
| Vibecode | UNVERIFIED | Their own iOS/Android app; share links and App Clips REPORTED (`docs/v2/research/competitor-architectures.md:45`) | None found | Credits: "$1 in credits on Vibecode = $1 in AI usage" | https://www.vibecodeapp.com/pricing |
| Replit | Webview | Expo Go | None | EAS to TestFlight / App Store | `docs/v2/research/competitor-architectures.md:42,212` |

Takeaways:
- The industry standard is **web preview + QR to a phone**. a0.dev and Vibecode moved from Expo Go to their **own preview app** to control the SDK and the native module set.
- Only Expo Snack shows in-browser devices, and it buys that from Appetize rather than running simulators.
- Rork Max's "browser installer over WebUSB" is a clever way to sideload a compiled iOS app without TestFlight; it needs a Mac and Chrome.

---

## 5. Recommended staged plan

### Phase 1: cheapest viable preview (weeks, not months)

Scope: Expo web in the iframe + QR to the phone. No new vendors.

1. **Template**: one Expo project template pinned to the SDK the store Expo Go runs (check https://expo.dev/go and the App Store listing at implementation time; SDK 57 is listed on expo.dev/go today). Include `expo-router`, `react-native-web`, `@expo/metro-runtime`, and a curated module allow-list that works in Expo Go and on web.
2. **Sandbox**: the harness scaffolds the project and starts `npx expo start --web --port 8081` (one Metro serves web and native). Export `EXPO_PACKAGER_PROXY_URL=https://<project>.preview.wandit.app` so the QR encodes the wandit proxy URL, not the vendor hostname (`docs/v2/research/sandboxes.md:294`). The proxy must forward WebSockets.
3. **UI**: reuse the web iframe with a phone-frame chrome and a "Scan with Expo Go" QR panel. Show a one-line install hint for Expo Go.
4. **Auth in generated apps**: mark OAuth as "needs the wandit preview app" and fall back to email/password or magic link in Expo Go.
5. **Ship**: "Install on your phone" = EAS internal distribution (Android APK link; iOS TestFlight through the user's own Apple account) and later `eas build --auto-submit`. Reuse the repo's existing EAS know-how (`apps/native/eas.json`, `.github/workflows/mobile-testflight.yml:59`).

Cost per active project hour: sandbox only (~$0.09 to $0.34, `docs/v2/research/sandboxes.md:48`). Fixed: $0. EAS: free 15+15 builds per month, then $1 to $4 per build, billed to wandit's EAS account or to the user's account.

Risk: Expo Go SDK drift and the Expo Go policy direction. Mitigation: start Phase 1.5 early.

### Phase 1.5: in-browser device preview on demand (Appetize) and a wandit preview app

1. Build a **wandit preview app** (`expo-dev-client`) per runtime: one iOS simulator build (`ios.simulator: true`) for Appetize, one iOS device build for TestFlight, one Android APK for Appetize and direct install. Rebuild only when the runtime's native module set changes.
2. Upload the simulator `.app` zip and the APK once with `POST https://api.appetize.io/v1/apps`; store the `publicKey`/`buildId`.
3. In the builder, add "Open on iPhone / Android in the browser". It embeds `https://appetize.io/embed/{buildId}` with `launchUrl` or `params` carrying the project's Metro URL. The dev client loads the live bundle; edits show without a rebuild. Set `timeout` (inactivity) to 120 s and `timeLimit` to 10 to 15 minutes to cap spend.
4. Users who want the real phone install the wandit preview app from TestFlight / Play internal testing and scan the same QR.

Cost: Appetize Starter $59/month (500 minutes, 3 concurrent) to start; Premium $319/month (16 concurrent) when queueing appears; $0.06 per extra minute. Rule of thumb: $3.60 per streamed device hour. Keep it on-demand, not on by default.

### Phase 2: wandit-owned device streaming

Android first (cheaper, fully open source):
- One bare-metal Linux host (Hetzner dedicated, or GCP N2 with nested virt at a ~10% penalty) running Google's emulator containers with the gRPC gateway and WebRTC frontend, or redroid + scrcpy-over-WebSocket for higher density without KVM.
- Stream through the wandit edge proxy; TURN server for NAT.
- Budget: one host with 16 vCPU / 64 GB handles roughly 8 to 12 emulators (UNVERIFIED). Hetzner dedicated prices were not captured (UNVERIFIED); GCP `n2-standard-16` is roughly $0.78/hour on demand (UNVERIFIED, not fetched).

iOS second (needs macOS, legal review first):
- Rent Mac minis from Scaleway (EU, EUR 0.22 to 0.49 per hour, 24-hour minimum) or MacStadium ($149 to $349 per month). AWS `mac-m4.metal` at about $1.23/hour is 5x Scaleway for similar hardware.
- Run simulators directly on the host; stream with `serve-sim` middleware through one port; input over its WebSocket. One serve-sim helper per booted simulator.
- Pool: start with 2 hosts (about EUR 300 to 400 per month) for 6 to 8 concurrent simulators; scale by adding hosts. Warm 1 to 2 booted simulators per host for sub-5-second attach.
- Legal: the macOS SLA permits virtualisation only for development and testing and bans "terminal sharing" on virtualised copies; bare-metal simulator use for wandit's customers needs counsel sign-off. AWS and Scaleway both encode the 24-hour lease rule.

Optional Phase 2 shortcut: Genymotion SaaS for Android at $0.06/minute with an MIT embed player, if wandit wants managed Android before self-hosting.

### Cost summary (monthly, order of magnitude)

| Stage | Fixed | Variable |
|---|---|---|
| Phase 1 | $0 | sandbox hours; EAS builds beyond 15+15 free ($1 to $4 each) |
| Phase 1.5 | $59 to $319 (Appetize) | $0.06 per device minute over 500; a few EAS builds per runtime change |
| Phase 2 Android | ~$100 to $300 for one bare-metal host (UNVERIFIED) | engineering time; TURN egress |
| Phase 2 iOS | EUR 300 to 700 for 2 to 4 Mac minis (Scaleway) or $300 to $700 (MacStadium) | engineering time; legal review |

---

## 6. Risks

1. **Expo Go policy and SDK drift**: store Expo Go lagged Expo SDKs for months in 2026 and Expo restricted EAS Update loading. A Phase 1 that depends on Expo Go can break on Expo's schedule. Own preview app (Phase 1.5) removes this.
2. **Public Metro URL**: the sandbox port is public; a leaked URL exposes source bundles. Sign URLs at the edge and rotate.
3. **Appetize price and concurrency**: at $0.06 per minute, an always-on device preview would cost more than the sandbox; queueing appears at 3 concurrent on Starter.
4. **Apple licence**: 2 VMs per host, 24-hour leases, and the "terminal sharing" clause. Interactive simulator streaming to customers is not the CI use Apple describes. Needs counsel.
5. **KVM**: Firecracker sandboxes cannot host Android emulators; a separate bare-metal or nested-virt fleet is needed.
6. **Store onboarding friction**: $99/year Apple, $25 Google plus a 12-tester 14-day closed test for personal accounts. Non-technical users will need a guided flow, and many will stop at "install on my phone".
7. **Web parity**: generated apps that use SwiftUI/Compose components, camera, biometrics or IAP look broken in the web preview. The generator's module allow-list must be enforced.
8. **Vendor drift**: LambdaTest rebranded to TestMu AI; Corellium sits under Cellebrite; the Tart repo slug now resolves to `openai/tart`. Re-check vendors before signing.

---

## 7. Unverified claims (collected)

- Appetize plan numbers ($59 Starter / $319 Premium / 500 minutes / $0.06 per minute / 2-3-16 concurrent) came through a render proxy of the pricing page; the raw page hides the table.
- BrowserStack App Live prices came through the same proxy.
- Whether the App Store Expo Go binary is SDK 57 today.
- Whether Expo Go dev-server loading (not EAS Update) will stay unrestricted.
- Whether Appetize devices can reach an arbitrary public HTTPS Metro host (Snack does it with its own runtime, so PLAUSIBLE).
- AWS Mac hourly prices ($0.65 / $0.878 / $1.23) are from a third-party mirror (instances.vantage.sh), not the AWS pricing page.
- Emulator and simulator density per host (all numbers are estimates).
- Hetzner dedicated server prices and GCP `n2-standard-16` price (not fetched).
- Android system image licensing for redistribution inside a hosted product.
- Cellebrite ownership of Corellium; current status of Apple vs Corellium.
- The macOS Tahoe SLA text (Sequoia SLA was read).
- Tart repository ownership after the `openai/tart` redirect.
- EAS build wall-clock times.
- "Expo Go v52" requirement on a0.dev Android is what their docs say today; it may be stale.
- Vibecode preview mechanics (docs host `docs.vibecodeapp.com` did not resolve).

---

## 8. Sources

Expo
- https://expo.dev/changelog/sdk-55
- https://expo.dev/changelog/sdk-56
- https://expo.dev/changelog/sdk-57
- https://expo.dev/changelog/expo-go-and-app-store-may-2026
- https://expo.dev/changelog/expo-go-loading-changes-may-2026
- https://expo.dev/changelog (index; EAS Observe GA 2026-08-20, build caching 2026-01-26, Gradle cache 2026-04-30, iOS device registration workflows 2026-06-15)
- https://expo.dev/go
- https://expo.dev/pricing
- https://docs.expo.dev/more/expo-cli/
- https://docs.expo.dev/workflow/web/
- https://docs.expo.dev/develop/development-builds/introduction/
- https://docs.expo.dev/get-started/set-up-your-environment/
- https://docs.expo.dev/build-reference/simulators/
- https://docs.expo.dev/build-reference/infrastructure/
- https://docs.expo.dev/build/internal-distribution/
- https://docs.expo.dev/build/orbit/
- https://docs.expo.dev/review/overview/
- https://docs.expo.dev/review/share-previews-with-your-team/
- https://docs.expo.dev/eas-update/getting-started/
- https://docs.expo.dev/eas/workflows/get-started/
- https://docs.expo.dev/versions/latest/sdk/ui/
- https://github.com/expo/snack ; https://raw.githubusercontent.com/expo/snack/main/website/src/client/components/DevicePreview/AppetizeFrame.tsx ; https://raw.githubusercontent.com/expo/snack/main/docs/url-query-parameters.md
- https://github.com/expo/orbit

Appetize and device clouds
- https://appetize.io/pricing (via https://r.jina.ai/)
- https://docs.appetize.io/llms.txt
- https://docs.appetize.io/rest-api/v1/create-new-app.md
- https://docs.appetize.io/rest-api/apps.md
- https://docs.appetize.io/rest-api/sessions.md
- https://docs.appetize.io/platform/app-management/uploading-apps/ios.md
- https://docs.appetize.io/platform/embedding-apps.md
- https://docs.appetize.io/javascript-sdk.md
- https://docs.appetize.io/javascript-sdk/configuration.md
- https://docs.appetize.io/platform/session-inactivity-timeout.md
- https://docs.appetize.io/features/devices-and-os-versions.md
- https://www.browserstack.com/pricing?product=app-live (via https://r.jina.ai/) ; https://www.browserstack.com/app-live
- https://www.testmuai.com/pricing/ (redirect from https://www.lambdatest.com/pricing)
- https://www.corellium.com/
- https://www.genymotion.com/pricing/ ; https://docs.genymotion.com/saas/ ; https://github.com/Genymobile/genymotion-device-web-player

Android emulators and KVM
- https://github.com/google/android-emulator-container-scripts
- https://github.com/remote-android/redroid-doc
- https://github.com/budtmo/docker-android
- https://docs.cloud.google.com/compute/docs/instances/nested-virtualization/overview
- https://learn.microsoft.com/en-us/azure/virtual-machines/sizes/general-purpose/dv5-series
- https://docs.hetzner.com/cloud/servers/faq/
- https://vercel.com/docs/sandbox/concepts

macOS hosting, VMs, simulator streaming
- https://www.apple.com/legal/sla/docs/macOSSequoia.pdf
- https://aws.amazon.com/ec2/instance-types/mac/ ; https://aws.amazon.com/ec2/dedicated-hosts/pricing/ ; https://instances.vantage.sh/aws/ec2/mac-m4.metal ; https://instances.vantage.sh/aws/ec2/mac2-m2.metal ; https://instances.vantage.sh/aws/ec2/mac2.metal
- https://www.macstadium.com/pricing ; https://www.macstadium.com/orka
- https://www.scaleway.com/en/pricing/apple-silicon/ ; https://www.scaleway.com/en/mac-mini-m4/ ; https://www.scaleway.com/en/docs/apple-silicon/how-to/setup-vm-with-utm/
- https://github.com/cirruslabs/tart ; https://tart.run/licensing/ ; https://tart.run/faq/
- https://github.com/trycua/lume
- https://github.com/evanbacon/serve-sim
- https://github.com/facebook/idb ; https://fbidb.io/docs/commands/

Stores
- https://developer.apple.com/programs/
- https://support.google.com/googleplay/android-developer/answer/6112435
- https://support.google.com/googleplay/android-developer/answer/14151465

Competitors
- https://support.bolt.new/integrations/expo
- https://rork.com/faq
- https://a0.dev/ ; https://docs.a0.dev/llms.txt ; https://docs.a0.dev/development/testing/web-preview.md ; https://docs.a0.dev/development/testing/mobile-app-testing.md
- https://www.vibecodeapp.com/pricing ; https://www.vibecodeapp.com/faq

Repo
- `apps/native/package.json:31,35,49,60,68`
- `apps/native/eas.json:7-12`
- `.github/workflows/mobile-testflight.yml:59`
- `docs/v2/research/inspect-native-and-simulator.md`
- `docs/v2/research/sandboxes.md:48,266,294-301,326-351`
- `docs/v2/research/ai-sdk-harness.md:16`
- `docs/v2/research/competitor-architectures.md:30,36-48,212-227`

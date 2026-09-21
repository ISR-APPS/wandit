# Sandbox image

The OCI image every V2 project sandbox boots from. `VercelSandboxProvider`
reads its tag from `VERCEL_SANDBOX_IMAGE`; unset falls back to the vendor
`vercel/sandbox/node:22` image, which lacks Claude Code, Chromium, and the
warm pnpm store.

Contents: Node 22, pnpm 11.7.0, git, Claude Code 2.1.245 (the version the
`@ai-sdk/harness-claude-code` bridge pins in `dist/bridge/pnpm-lock.yaml`),
Expo CLI 56 (Metro slice, WANDIT-193), Playwright 1.61.1 with Chromium under
`/ms-playwright`, and a non-root `builder` user with `/workspace` as the
project root.

## Build

Build from the repo root — the Dockerfile copies
`templates/web-app/pnpm-lock.yaml` to warm the offline pnpm store:

```sh
docker build -f tooling/sandbox-image/Dockerfile -t wandit-sandbox:0.1.0 .
```

Pack the template first when it changed — `pnpm run pack` runs
`scripts/pack.mjs`, which writes `templates/web-app-<version>.tar.gz`
(`pnpm pack` without `run` is the pnpm built-in, not the script):

```sh
cd templates/web-app && pnpm run pack
```

## Push to Vercel Container Registry

UNVERIFIED: the exact `vcr` CLI flow. Per the Vercel sandbox docs, custom
images are pushed to the team Container Registry and referenced by name:

```sh
vcr login                                     # or: vercel login + vcr auth
docker tag wandit-sandbox:0.1.0 <team>.vcr.dev/wandit-sandbox:0.1.0
docker push <team>.vcr.dev/wandit-sandbox:0.1.0
```

Then set the pushed tag on the server environment:

```
VERCEL_SANDBOX_IMAGE=<team>.vcr.dev/wandit-sandbox:0.1.0
```

Bump the tag on every image change; a sandbox resumes from its snapshot, so
a new tag only reaches new or rebuilt sandboxes.

## Notes

- `ENTRYPOINT`/`CMD` never run — Vercel executes `runCommand` directly.
- Whether the platform honors `USER builder` for `runCommand` is UNVERIFIED.
- Chromium launches inside the sandbox only when WANDIT-180 sets
  `PLAYWRIGHT_SERVICE`; the image installs the browser but does not start it.

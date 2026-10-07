# syntax=docker/dockerfile:1

# Vercel Sandbox base: Ubuntu with Node 22 and pnpm. Vercel pulls this name
# from its own registry; local builds need `vcr login` first (see README).
FROM vercel/sandbox/node:22

USER root

# git: template-init commits the applied template into a fresh repo.
RUN apt-get update \
	&& apt-get install -y --no-install-recommends git \
	&& rm -rf /var/lib/apt/lists/*

# The repo standardizes on pnpm 11.7.0. `npm -g`, not corepack: corepack
# caches under /root, which the builder user cannot read.
RUN npm install -g pnpm@11.7.0

# Claude Code at the exact version the @ai-sdk/harness-claude-code bridge
# pins in dist/bridge/pnpm-lock.yaml. A different version desyncs the bridge.
RUN npm install -g @anthropic-ai/claude-code@2.1.245

# No global Expo CLI: `pnpm run dev` of the mobile-app template runs the
# project-local `expo` (SDK 57). A global copy of another SDK only misleads.

# Playwright CLI + Chromium. PLAYWRIGHT_BROWSERS_PATH is shared so the
# non-root runtime user finds the browsers that root installed.
RUN npm install -g playwright@1.61.1
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN playwright install --with-deps chromium \
	&& chmod -R a+rX /ms-playwright

# Non-root runtime user. Vercel documents that ENTRYPOINT/CMD do not run;
# whether the platform honors USER for runCommand is UNVERIFIED — the
# image still declares it so a direct docker run is non-root.
RUN useradd -m -s /bin/bash builder \
	&& mkdir -p /workspace /opt/template-lock/web-app /opt/template-lock/mobile-app \
	&& chown -R builder:builder /workspace /opt/template-lock

# The template lockfiles warm the builder's pnpm store at build time, so
# `pnpm install --frozen-lockfile --offline` in ArchiveTemplateInit hits
# the store instead of the network, for web and mobile projects.
COPY --chown=builder:builder templates/web-app/pnpm-lock.yaml /opt/template-lock/web-app/pnpm-lock.yaml
COPY --chown=builder:builder templates/mobile-app/pnpm-lock.yaml /opt/template-lock/mobile-app/pnpm-lock.yaml

USER builder
WORKDIR /workspace
RUN cd /opt/template-lock/web-app && pnpm fetch \
	&& cd /opt/template-lock/mobile-app && pnpm fetch

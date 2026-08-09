#!/usr/bin/env node
/**
 * Seed wrangler's LOCAL KV + R2 state so `pnpm --filter edge dev` can serve
 * a real published site without touching Cloudflare.
 *
 * Usage (from apps/edge):
 *   node scripts/seed-local.mjs --project <projectId> --slug <slug> [--html <file>]
 *
 * Seeds:
 *   R2  published/{projectId}/current.html          (from --html, or a demo page)
 *   KV  domain:{slug}.wandit.app                    {projectId, source:"slug", slug}
 *   KV  domain:www.brand.com                        {projectId, source:"domain"}   ← the
 *       exact 2-field shape the domains pipeline writes (pointer-contract check)
 *   KV  domain:banned.wandit.app                    suspended pointer (403 page)
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);

function arg(name) {
	const index = args.indexOf(`--${name}`);

	return index >= 0 ? args[index + 1] : undefined;
}

const projectId = arg("project");
const slug = arg("slug");
const htmlFile = arg("html");

if (!projectId || !slug) {
	console.error(
		"Usage: node scripts/seed-local.mjs --project <projectId> --slug <slug> [--html <file>]",
	);
	process.exit(1);
}

const html = htmlFile
	? readFileSync(htmlFile, "utf8")
	: `<!doctype html><html><head><meta charset="utf-8"><title>${slug}</title></head><body><h1>Seeded site for ${slug}</h1><p>project ${projectId}</p></body></html>`;

const htmlPath = join(
	mkdtempSync(join(tmpdir(), "edge-seed-")),
	"current.html",
);
writeFileSync(htmlPath, html);

const PERSIST = [
	"--config",
	"wrangler.dev.jsonc",
	"--local",
	"--persist-to",
	".wrangler/state",
];

function wrangler(...cmd) {
	const result = spawnSync("npx", ["wrangler", ...cmd, ...PERSIST], {
		stdio: "inherit",
	});

	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}
}

wrangler(
	"r2",
	"object",
	"put",
	`wandit-pages-dev/published/${projectId}/current.html`,
	"--file",
	htmlPath,
	"--content-type",
	"text/html",
);

wrangler(
	"kv",
	"key",
	"put",
	`domain:${slug}.wandit.app`,
	JSON.stringify({ projectId, slug, source: "slug" }),
	"--binding",
	"PTR",
);

// The 2-field shape the domains pipeline writes — on purpose.
wrangler(
	"kv",
	"key",
	"put",
	"domain:www.brand.com",
	JSON.stringify({ projectId, source: "domain" }),
	"--binding",
	"PTR",
);

wrangler(
	"kv",
	"key",
	"put",
	"domain:banned.wandit.app",
	JSON.stringify({ projectId, source: "slug", status: "suspended" }),
	"--binding",
	"PTR",
);

console.log(`\nSeeded. Start the worker and probe it:
  pnpm --filter edge dev            # listens on :8799

  curl -sI -H "Host: ${slug}.wandit.app"      http://127.0.0.1:8799/   # 200 site
  curl -sI -H "Host: www.brand.com"           http://127.0.0.1:8799/   # 200 (2-field pointer)
  curl -sI -H "Host: brand.com"               http://127.0.0.1:8799/   # 301 → https://www.brand.com/
  curl -sI -H "Host: nope.wandit.app"         http://127.0.0.1:8799/   # 404 + no-store
  curl -sI -H "Host: banned.wandit.app"       http://127.0.0.1:8799/   # 403 suspended
  curl -sI -H "Host: customers.wandit.app"    http://127.0.0.1:8799/   # 200 health
`);

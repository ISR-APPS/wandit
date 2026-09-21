/**
 * Live proof of the sandbox egress policy: deny-by-default, a live policy
 * update, an env without secrets, and no secret on disk. Runs only with
 * V2_SANDBOX_INTEGRATION_TEST=true; it creates one real sandbox on Vercel
 * (cost: cents) and destroys it in `finally`.
 */
import { env } from "@wandit/env/server";
import { describe, expect, it } from "vitest";

import type { SandboxCreateOptions } from "../../domain/ports/sandbox-provider";
import { LoggingRepoRestorer } from "../git/logging-repo-restorer";
import { FakeSandboxSessionsRepository } from "../persistence/fake-sandbox-sessions.repository";
import { GLOBAL_ALLOWED_HOSTS, SANDBOX_DENIED_RANGES } from "./network-policy";
import { SANDBOX_ENV_ALLOW_LIST } from "./sandbox-env";
import { ArchiveTemplateInit, TEMPLATE_ARCHIVE_DIR } from "./template-init";
import { VercelSandboxProvider } from "./vercel-sandbox.provider";

// Runs only with V2_SANDBOX_INTEGRATION_TEST=true: it creates a real
// sandbox on Vercel and costs money. CI never sets the flag.
const RUN = process.env.V2_SANDBOX_INTEGRATION_TEST === "true";

/**
 * Env names the vendor image itself sets; everything else must come from
 * `SANDBOX_ENV_ALLOW_LIST` or start with `VERCEL_`. The *_CA_BUNDLE, *_CERT,
 * and *_CAINFO names point the image toolchains at the sandbox CA bundle.
 */
const VENDOR_ENV_NAMES = [
	"PATH",
	"HOME",
	"PWD",
	"SHLVL",
	"_",
	"HOSTNAME",
	"TERM",
	"LANG",
	"OLDPWD",
	"AWS_CA_BUNDLE",
	"CARGO_HTTP_CAINFO",
	"CURL_CA_BUNDLE",
	"GIT_SSL_CAINFO",
	"GRPC_DEFAULT_SSL_ROOTS_FILE_PATH",
	"NODE_EXTRA_CA_CERTS",
	"NODE_USE_SYSTEM_CA",
	"NPM_CONFIG_CAFILE",
	"PIP_CERT",
	"REQUESTS_CA_BUNDLE",
	"SSL_CERT_FILE",
];

/** The first `length` chars of `value`, or undefined when there is no value. */
function needle(value: string | undefined, length: number): string | undefined {
	return value && value.length > 0 ? value.slice(0, length) : undefined;
}

/**
 * The image has no curl or wget: the HTTP probes run `fetch` through node.
 * Exit 0 only on a 2xx answer, so a proxy-blocked response counts as denied.
 */
function fetchProbe(url: string, timeoutMs: number): string[] {
	return [
		"-e",
		`fetch(${JSON.stringify(url)},{signal:AbortSignal.timeout(${timeoutMs})}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))`,
	];
}

describe.skipIf(!RUN)("sandbox hardening integration", () => {
	it("denies egress by default, updates the policy live, and leaks no secret", async () => {
		const sessions = new FakeSandboxSessionsRepository();
		const provider = new VercelSandboxProvider(
			sessions,
			new LoggingRepoRestorer(),
			new ArchiveTemplateInit(TEMPLATE_ARCHIVE_DIR),
		);
		const projectId = `it-hardening-${Date.now()}`;
		const proxyBaseUrl = new URL(
			"/api/v2/llm",
			env.V2_LLM_PROXY_PUBLIC_URL ?? env.BETTER_AUTH_URL,
		).toString();
		const options: SandboxCreateOptions = {
			devCommand: "pnpm dev",
			devPort: 3000,
			env: {
				ANTHROPIC_AUTH_TOKEN: "integration-run-token",
				ANTHROPIC_BASE_URL: proxyBaseUrl,
				ANTHROPIC_API_KEY: "",
				CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
			},
			framework: "web-app",
			organizationId: null,
			ownerUserId: "integration-user",
			templateVersion: "web-app@1.0.0",
		};

		try {
			const startedAt = Date.now();
			const handle = await provider.getOrCreate(projectId, options);
			console.log(`create took ${Date.now() - startedAt}ms`);

			// A host outside the allow list is denied.
			const denied = await handle.exec(
				"node",
				fetchProbe("https://example.com", 15_000),
			);
			expect(denied.exitCode).not.toBe(0);

			// A host on the global list answers.
			const registry = await handle.exec(
				"node",
				fetchProbe("https://registry.npmjs.org/react", 15_000),
			);
			expect(registry.exitCode).toBe(0);

			// The link-local metadata range stays denied.
			const metadata = await handle.exec(
				"node",
				fetchProbe("http://169.254.169.254/", 5_000),
			);
			expect(metadata.exitCode).not.toBe(0);

			// A live policy update adds example.com without a restart.
			const updatedAt = Date.now();
			await handle.setNetworkPolicy({
				allowedHosts: [
					...GLOBAL_ALLOWED_HOSTS,
					new URL(proxyBaseUrl).hostname,
					"example.com",
				],
				deniedRanges: [...SANDBOX_DENIED_RANGES],
			});
			const allowed = await handle.exec(
				"node",
				fetchProbe("https://example.com", 15_000),
			);
			console.log(`policy update took ${Date.now() - updatedAt}ms`);
			expect(allowed.exitCode).toBe(0);

			// The process env holds only allow-listed and vendor names.
			const printenv = await handle.exec("node", [
				"-e",
				'console.log(Object.keys(process.env).sort().join("\\n"))',
			]);
			const names = printenv.stdout
				.split("\n")
				.map((line) => line.trim())
				.filter((name) => name.length > 0)
				.sort();
			console.log("sandbox env names:", names.join(","));
			const allowedNames = new Set<string>([
				...SANDBOX_ENV_ALLOW_LIST,
				...VENDOR_ENV_NAMES,
			]);
			const unexpected = names.filter(
				(name) => !allowedNames.has(name) && !name.startsWith("VERCEL_"),
			);
			if (unexpected.length > 0) {
				console.log("unexpected env names:", unexpected.join(","));
			}
			expect(unexpected).toEqual([]);

			// The leak grep needs grep inside the VM; without it the empty
			// stdout below would prove nothing.
			const grepProbe = await handle.exec("bash", ["-c", "command -v grep"]);
			expect(grepProbe.exitCode).toBe(0);

			// No platform secret reaches a file inside the VM. The needles go
			// through the exec env, never into the command string or a log.
			const privateKeyBody = env.CODE_STORAGE_PRIVATE_KEY?.replace(/\\n/g, "\n")
				.split("\n")
				.filter((line) => line.length > 0 && !line.startsWith("-----"))
				.join("");
			const leakEnv: Record<string, string> = { WS: handle.workspaceDir };
			for (const [name, value] of [
				["P1", needle(env.VERCEL_SANDBOX_TOKEN, 12)],
				["P2", needle(env.LLM_PROXY_SIGNING_KEY?.split(",").at(0), 12)],
				["P3", needle(privateKeyBody, 24)],
			] as const) {
				if (value === undefined) {
					// grep cannot skip a pattern in a fixed script; the sentinel
					// matches nothing.
					console.log(`${name}: source env unset, needle is a sentinel`);
					leakEnv[name] = `unset-needle-${name}`;
				} else {
					leakEnv[name] = value;
				}
			}
			// When the vendor env drops HOME, the home scan must print a
			// marker, or it silently disappears into the empty-stdout pass.
			const leak = await handle.exec(
				"bash",
				[
					"-c",
					'test -d "$HOME" || echo HOME_MISSING; grep -rIl -e "sk-ant-" -e "$P1" -e "$P2" -e "$P3" "$HOME" "$WS" 2>/dev/null; true',
				],
				{ env: leakEnv },
			);
			expect(leak.stdout.trim()).toBe("");

			const whoami = await handle.exec("node", [
				"-e",
				'console.log(require("node:os").userInfo().username)',
			]);
			const sandboxUser = whoami.stdout.trim();
			console.log(`sandbox user: ${sandboxUser}`);
			expect(sandboxUser).not.toBe("root");
		} finally {
			await provider.destroy(projectId);
		}
	}, 600_000);
});

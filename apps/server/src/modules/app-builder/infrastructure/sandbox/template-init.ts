/**
 * Initializes a fresh sandbox disk from a template archive.
 * `VercelSandboxProvider` calls `apply` whenever the vendor creates a new
 * sandbox (first create and rebuild); the idle sweep never calls it.
 * Reads the archive from the repo `templates/` folder that WANDIT-168 fills.
 */
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { env } from "@wandit/env/server";
import { Sentry } from "@wandit/observability/node";

import { TemplateArchiveMissingError } from "../../domain/errors/template-archive-missing.error";
import type {
	SandboxHandle,
	SandboxLogger,
} from "../../domain/ports/sandbox-provider";

/** Nest token for the `TemplateInit` implementation. */
export const TEMPLATE_INIT = Symbol.for("app-builder.template-init");

/** What a template init needs to put a project skeleton into a sandbox. */
export interface TemplateInit {
	apply(
		sandbox: SandboxHandle,
		options: { framework: string; templateVersion: string },
	): Promise<void>;
}

/**
 * Picks the folder that holds the `<framework>-<version>.tar.gz` archives.
 * `explicitDir` is `TEMPLATE_ARCHIVE_DIR` from the env and wins when set: a
 * deployed worker or API carries the archive at a fixed path. Otherwise the
 * first existing candidate wins: `<cwd>/templates`, `<cwd>/../../templates`
 * (the Trigger dev worker and the API run from `apps/server`), then
 * `templates/` next to this source file. The Trigger worker bundles this
 * file under `.trigger/`, so the source path alone is wrong there. The last
 * candidate is returned even when absent, so the error names a path.
 */
export function resolveTemplateArchiveDir(
	explicitDir: string | undefined,
	cwd: string = process.cwd(),
): string {
	if (explicitDir) {
		return resolve(explicitDir);
	}
	const sourceRelative = resolve(
		dirname(fileURLToPath(import.meta.url)),
		"../../../../../../../templates",
	);
	const candidates = [
		resolve(cwd, "templates"),
		resolve(cwd, "../../templates"),
		sourceRelative,
	];
	return candidates.find((dir) => existsSync(dir)) ?? sourceRelative;
}

/** The archive folder this process uses; see `resolveTemplateArchiveDir`. */
export const TEMPLATE_ARCHIVE_DIR = resolveTemplateArchiveDir(
	env.TEMPLATE_ARCHIVE_DIR,
);

/** Upload target for the archive; `tar` reads it from here. */
const ARCHIVE_PATH = "/tmp/template.tar.gz";

/**
 * Uploads `<framework>-<semver>.tar.gz`, extracts it into
 * `sandbox.workspaceDir`, installs dependencies, and commits the result
 * so later turns diff against a clean baseline.
 */
export class ArchiveTemplateInit implements TemplateInit {
	constructor(
		/** Folder that holds the archive files, for example `templates/`. */
		private readonly templateDir: string,
		private readonly logger: SandboxLogger = Sentry.logger,
	) {}

	async apply(
		sandbox: SandboxHandle,
		options: { framework: string; templateVersion: string },
	): Promise<void> {
		// "web-app@1.0.0" and "1.0.0" both map to `web-app-1.0.0.tar.gz`.
		const version = options.templateVersion.split("@").pop();
		const archivePath = join(
			this.templateDir,
			`${options.framework}-${version}.tar.gz`,
		);
		const bytes = await readFile(archivePath).catch((error: unknown) => {
			throw new TemplateArchiveMissingError(archivePath, error);
		});

		await sandbox.writeFiles([{ content: bytes, path: ARCHIVE_PATH }]);
		await this.mustRun(sandbox, "mkdir", ["-p", sandbox.workspaceDir]);
		await this.mustRun(sandbox, "tar", [
			"-xzf",
			ARCHIVE_PATH,
			"-C",
			sandbox.workspaceDir,
		]);

		// The image ships a warm pnpm store; offline first keeps the create fast.
		const offline = await sandbox.exec(
			"pnpm",
			["install", "--frozen-lockfile", "--offline"],
			{ cwd: sandbox.workspaceDir },
		);
		if (offline.exitCode !== 0) {
			// LIMIT: the sandbox image warms only the web-app pnpm store, so a mobile install downloads every package. Upgrade: fetch the mobile-app lockfile in the image too.
			this.logger.warn("sandbox.template-init.offline-install-miss", {
				sandboxId: sandbox.providerSandboxId,
			});
			await this.mustRun(sandbox, "pnpm", ["install", "--frozen-lockfile"], {
				cwd: sandbox.workspaceDir,
			});
		}

		const hasRepo = await sandbox.exec("git", ["rev-parse", "--git-dir"], {
			cwd: sandbox.workspaceDir,
		});
		if (hasRepo.exitCode !== 0) {
			await this.mustRun(sandbox, "git", ["init"], {
				cwd: sandbox.workspaceDir,
			});
			await this.mustRun(sandbox, "git", ["add", "-A"], {
				cwd: sandbox.workspaceDir,
			});
			await this.mustRun(
				sandbox,
				"git",
				[
					"-c",
					"user.name=wandit",
					"-c",
					"user.email=builder@wandit.dev",
					"commit",
					"-m",
					`init: template ${options.templateVersion}`,
				],
				{ cwd: sandbox.workspaceDir },
			);
		}
	}

	private async mustRun(
		sandbox: SandboxHandle,
		command: string,
		args: string[],
		options?: { cwd: string },
	): Promise<void> {
		const result = await sandbox.exec(command, args, options);
		if (result.exitCode !== 0) {
			throw new Error(
				`Template init failed at "${command} ${args.join(" ")}" ` +
					`in sandbox ${sandbox.providerSandboxId}: ${result.stderr}`,
			);
		}
	}
}

/**
 * Initializes a fresh sandbox disk from a template archive.
 * `VercelSandboxProvider` calls `apply` when the vendor creates a new
 * sandbox without the template snapshot, and when it builds that snapshot.
 * It calls `contentHash` for the snapshot name. The idle sweep never calls it.
 * Reads the archive from the repo `templates/` folder that WANDIT-168 fills.
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

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
	/**
	 * SHA-256 hex of the files `apply` writes. Two packs of the same files
	 * give the same hash, so it keys the template snapshot.
	 */
	contentHash(options: {
		framework: string;
		templateVersion: string;
	}): Promise<string>;
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
 * Author and committer date of the template commit. A fixed date gives the
 * same commit SHA for the same files, so every sandbox of one template
 * shares its root commit with the code.storage copy.
 */
const TEMPLATE_COMMIT_DATE = "2000-01-01T00:00:00Z";

/** Size of one tar header and of one content block. */
const TAR_BLOCK_BYTES = 512;

/**
 * SHA-256 hex of the regular files and symlinks in a `.tar.gz`, by path,
 * mode, and content. It ignores file times and entry order, which change
 * with each checkout that packs the same files.
 */
export function hashTemplateArchive(archive: Uint8Array): string {
	const tar = gunzipSync(archive);
	const entries: string[] = [];
	let offset = 0;
	// A zero block ends the archive; a truncated archive ends the loop too.
	while (offset + TAR_BLOCK_BYTES <= tar.length) {
		const header = tar.subarray(offset, offset + TAR_BLOCK_BYTES);
		if (header.every((byte) => byte === 0)) {
			break;
		}
		// Header fields of the ustar format: offsets and lengths in bytes.
		const name = tarText(header, 0, 100);
		const mode = tarText(header, 100, 8);
		const size = Number.parseInt(tarText(header, 124, 12) || "0", 8);
		const type = tarText(header, 156, 1);
		const path = posix.join(tarText(header, 345, 155), name);
		const contentStart = offset + TAR_BLOCK_BYTES;
		// "0" and an empty type are regular files, "2" is a symlink. A folder
		// or a pax header holds no project file.
		if (type === "0" || type === "") {
			const content = tar.subarray(contentStart, contentStart + size);
			entries.push(`${path}\0${mode}\0${sha256Hex(content)}`);
		} else if (type === "2") {
			entries.push(`${path}\0${mode}\0->${tarText(header, 157, 100)}`);
		}
		offset = contentStart + Math.ceil(size / TAR_BLOCK_BYTES) * TAR_BLOCK_BYTES;
	}
	return sha256Hex(entries.sort().join("\n"));
}

/** One NUL-padded text field of a tar header, trimmed. */
function tarText(header: Uint8Array, start: number, length: number): string {
	const field = header.subarray(start, start + length);
	const end = field.indexOf(0);
	return Buffer.from(end === -1 ? field : field.subarray(0, end))
		.toString("utf8")
		.trim();
}

function sha256Hex(content: Uint8Array | string): string {
	return createHash("sha256").update(content).digest("hex");
}

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
		const bytes = await this.readArchive(options);

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
				{
					cwd: sandbox.workspaceDir,
					env: {
						GIT_AUTHOR_DATE: TEMPLATE_COMMIT_DATE,
						GIT_COMMITTER_DATE: TEMPLATE_COMMIT_DATE,
					},
				},
			);
		}
	}

	async contentHash(options: {
		framework: string;
		templateVersion: string;
	}): Promise<string> {
		return hashTemplateArchive(await this.readArchive(options));
	}

	/** The archive bytes; throws `TemplateArchiveMissingError` with the path. */
	private async readArchive(options: {
		framework: string;
		templateVersion: string;
	}): Promise<Buffer> {
		// "web-app@1.0.0" and "1.0.0" both map to `web-app-1.0.0.tar.gz`.
		const version = options.templateVersion.split("@").pop();
		const archivePath = join(
			this.templateDir,
			`${options.framework}-${version}.tar.gz`,
		);
		return readFile(archivePath).catch((error: unknown) => {
			throw new TemplateArchiveMissingError(archivePath, error);
		});
	}

	private async mustRun(
		sandbox: SandboxHandle,
		command: string,
		args: string[],
		options?: { cwd: string; env?: Record<string, string> },
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

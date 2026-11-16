/**
 * Puts the files of one starter template archive into the workspace of a
 * project sandbox. The `apply-starter-template` runtime calls
 * `applyStarterTemplateArchive`. `AppProjectsService` and the task read the
 * archive path from `starterTemplateArchivePath`. It runs tar, cp, and rm in
 * the sandbox through `exec`, and parses `manifest.json` with the contracts schema.
 */
import { join, posix } from "node:path";
import { starterTemplateManifestSchema } from "@wandit/contracts/v2/starter-template-archive";

import type {
	SandboxExecResult,
	SandboxReader,
} from "../../domain/ports/sandbox-provider";

// Both paths are outside the workspace: a file in the workspace would enter the commit.
const SANDBOX_ARCHIVE_PATH = "/tmp/wandit-starter-template.tar.gz";
const SANDBOX_EXTRACT_DIR = "/tmp/wandit-starter-template";
// 500 chars of stderr: enough for the tar, cp, or rm error line.
const STDERR_MAX_CHARS = 500;

/**
 * The archive of one starter template inside `templateDir`, the folder of
 * `TEMPLATE_ARCHIVE_DIR`. `templates/starters/scripts/pack.mjs` writes this name.
 */
export function starterTemplateArchivePath(
	templateDir: string,
	starterTemplateId: string,
): string {
	return join(templateDir, `starter-${starterTemplateId}.tar.gz`);
}

// Runs one command in the sandbox. A non-zero exit throws with the step name and the end of stderr.
async function mustRun(
	sandbox: Pick<SandboxReader, "exec">,
	step: string,
	command: string,
	args: string[],
	cwd?: string,
): Promise<SandboxExecResult> {
	const result = await sandbox.exec(command, args, { cwd });
	if (result.exitCode !== 0) {
		throw new Error(
			`Starter template ${step} failed (${result.exitCode}): ${result.stderr.slice(-STDERR_MAX_CHARS)}`,
		);
	}
	return result;
}

/**
 * Copies `files/` of the archive over the workspace and deletes each path of
 * `manifest.removed`. It changes no file before the manifest passes its
 * checks. A second call gives the same workspace, so a retry is safe. It
 * runs no install: a starter template never changes `package.json`.
 * Throws on a failed command and on a bad manifest.
 */
export async function applyStarterTemplateArchive(
	sandbox: Pick<
		SandboxReader,
		"exec" | "readFile" | "workspaceDir" | "writeFiles"
	>,
	archive: {
		/** The catalog id. The manifest of the archive must hold the same id. */
		starterTemplateId: string;
		/** The bytes of `starter-<id>.tar.gz`. */
		bytes: Uint8Array;
	},
): Promise<void> {
	// A failed earlier attempt can leave its files in /tmp.
	await mustRun(sandbox, "clean", "rm", [
		"-rf",
		SANDBOX_EXTRACT_DIR,
		SANDBOX_ARCHIVE_PATH,
	]);
	await mustRun(sandbox, "mkdir", "mkdir", ["-p", SANDBOX_EXTRACT_DIR]);
	await sandbox.writeFiles([
		{ content: archive.bytes, path: SANDBOX_ARCHIVE_PATH },
	]);
	await mustRun(sandbox, "extract", "tar", [
		"-xzf",
		SANDBOX_ARCHIVE_PATH,
		"-C",
		SANDBOX_EXTRACT_DIR,
	]);

	const manifestBytes = await sandbox.readFile(
		posix.join(SANDBOX_EXTRACT_DIR, "manifest.json"),
	);
	if (manifestBytes === null) {
		throw new Error("Starter template archive has no manifest.json");
	}
	// Security check: the manifest is a file from outside this process. The
	// schema keeps each removed path inside the workspace.
	const manifest = starterTemplateManifestSchema.parse(
		JSON.parse(new TextDecoder().decode(manifestBytes)),
	);
	if (manifest.id !== archive.starterTemplateId) {
		throw new Error(
			`Starter template archive holds the id ${manifest.id}, not ${archive.starterTemplateId}`,
		);
	}

	// "files/." copies the content of the folder, with its dot files, and not the folder.
	await mustRun(sandbox, "copy", "cp", [
		"-R",
		posix.join(SANDBOX_EXTRACT_DIR, "files", "."),
		sandbox.workspaceDir,
	]);
	if (manifest.removed.length > 0) {
		// An argument array, never a shell string. "--" stops a path that starts with "-" from being an option.
		await mustRun(
			sandbox,
			"delete",
			"rm",
			["-rf", "--", ...manifest.removed],
			sandbox.workspaceDir,
		);
	}
	await mustRun(sandbox, "clean", "rm", [
		"-rf",
		SANDBOX_EXTRACT_DIR,
		SANDBOX_ARCHIVE_PATH,
	]);
}

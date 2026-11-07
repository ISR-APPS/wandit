/**
 * Reads and writes src/styles/theme.json in the sandbox of a web-app@1.1.0+ or desktop-app@1.0.0+ project.
 * Only the host writes it.
 * builder-turn.runtime.ts (pre-turn fallback, theme answer, turn-end guard), the set_theme tool, and the
 * theme routes (AppThemeService) call it.
 * It parses with the contracts schema and writes JSON with tabs, the format of the template file.
 * It reads the HEAD copy with `git show` through the sandbox exec.
 */
import { posix } from "node:path";

import {
	type AppThemeFile,
	appThemeFileSchema,
} from "@wandit/contracts/v2/app-theme";

import type { SandboxReader } from "../../domain/ports/sandbox-provider";
import { SAFE_GIT_CONFIG_ARGS } from "../git/sandbox-git";

/** The theme file inside the project. The template settings deny Edit and Write on it to the agent. */
export const APP_THEME_FILE_PATH = "src/styles/theme.json";

/** The bytes of theme.json: JSON with tabs and a last newline, so biome in the template keeps the file as it is. */
export function appThemeFileText(file: AppThemeFile): string {
	return `${JSON.stringify(file, null, "\t")}\n`;
}

/**
 * The theme file of the sandbox, or null when it does not exist. `file` is null when the text is not
 * JSON or fails the schema, for example after a script of the agent changed it.
 */
export async function readAppThemeFile(
	sandbox: Pick<SandboxReader, "readFile" | "workspaceDir">,
): Promise<{ text: string; file: AppThemeFile | null } | null> {
	const bytes = await sandbox.readFile(
		posix.join(sandbox.workspaceDir, APP_THEME_FILE_PATH),
	);
	if (bytes === null) {
		return null;
	}
	const text = new TextDecoder().decode(bytes);
	return { file: parseAppThemeFileText(text), text };
}

/**
 * The theme file of the HEAD commit, or null when HEAD holds no theme.json that parses.
 * The pre-turn fallback of builder-turn.runtime.ts compares it with the disk file. A failed exec throws.
 */
export async function readHeadAppThemeFile(
	sandbox: Pick<SandboxReader, "exec" | "workspaceDir">,
): Promise<AppThemeFile | null> {
	// The safe flags turn off the hooks and helpers that sandbox code can set in `.git/config`.
	const result = await sandbox.exec(
		"git",
		[...SAFE_GIT_CONFIG_ARGS, "show", `HEAD:${APP_THEME_FILE_PATH}`],
		{ cwd: sandbox.workspaceDir },
	);
	// `git show` exits non-zero in a repository with no commit, and when HEAD has no such file.
	return result.exitCode === 0 ? parseAppThemeFileText(result.stdout) : null;
}

/** The theme file in `text`, or null when the text is not JSON or fails the schema. */
export function parseAppThemeFileText(text: string): AppThemeFile | null {
	let json: unknown;
	try {
		json = JSON.parse(text);
	} catch {
		// Text that is not JSON is a broken file, the same as a file that fails the schema.
		return null;
	}
	const parsed = appThemeFileSchema.safeParse(json);
	return parsed.success ? parsed.data : null;
}

/** Writes `file` in the format of appThemeFileText. Vite reloads every page of the preview. */
export async function writeAppThemeFile(
	sandbox: Pick<SandboxReader, "writeFiles" | "workspaceDir">,
	file: AppThemeFile,
): Promise<void> {
	await sandbox.writeFiles([
		{
			content: appThemeFileText(file),
			path: posix.join(sandbox.workspaceDir, APP_THEME_FILE_PATH),
		},
	]);
}

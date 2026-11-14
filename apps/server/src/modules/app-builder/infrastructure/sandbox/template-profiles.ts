/**
 * One template profile per target platform: the archive prefix, the dev
 * server command and port, and the version file. `AppProjectsService` and
 * `TemplateVersionService` read it by platform; the builder-turn runtime and
 * `startSandboxWithoutTurn` (restore, wake, publish) read it by
 * `projects.framework`. Only `readFirstLine` touches the disk.
 */
import { readFileSync } from "node:fs";
import type { TargetPlatform } from "@wandit/contracts";

import { UnknownTemplateFrameworkError } from "../../domain/errors/unknown-template-framework.error";

/** What the server needs to create, boot, and version a project of one platform. */
export type TemplateProfile = {
	/** Value of `projects.framework`, and the archive prefix: `<framework>-<semver>.tar.gz`. */
	framework: string;
	/** Shell command of the dev server; the provider runs it on every create and resume. */
	devCommand: string;
	/** Port of the dev server. The preview host and the preview token point at it. */
	devPort: number;
	/** Version file, relative to `TEMPLATE_ARCHIVE_DIR`. Line 1 is `<framework>@<semver>`. */
	versionFile: string;
};

/** The profiles, keyed by `projects.target_platform`. Frozen: no caller may change one. */
export const TEMPLATE_PROFILES: Readonly<
	Record<TargetPlatform, Readonly<TemplateProfile>>
> = Object.freeze({
	web: Object.freeze({
		devCommand: "pnpm run dev",
		// The Vite default port of the web-app template.
		devPort: 5173,
		framework: "web-app",
		versionFile: "web-app/template_version",
	}),
	mobile: Object.freeze({
		devCommand: "pnpm run dev",
		// One Metro on the Expo default port serves the web app and the native
		// manifest (WANDIT-191 contract).
		devPort: 8081,
		framework: "mobile-app",
		versionFile: "mobile-app/template_version",
	}),
	desktop: Object.freeze({
		devCommand: "pnpm run dev",
		// The Vite default port. The preview runs the frontend of the Tauri app
		// in the browser, with a sql.js database in place of the Rust one.
		devPort: 5173,
		framework: "desktop-app",
		versionFile: "desktop-app/template_version",
	}),
});

/**
 * The profile whose `framework` equals `projects.framework`. The builder-turn
 * runtime and `startSandboxWithoutTurn` call it: they read only that column.
 * Throws `UnknownTemplateFrameworkError` for a value no profile owns.
 */
export function profileForFramework(
	framework: string,
): Readonly<TemplateProfile> {
	const profile = Object.values(TEMPLATE_PROFILES).find(
		(candidate) => candidate.framework === framework,
	);
	if (profile === undefined) {
		throw new UnknownTemplateFrameworkError(framework);
	}
	return profile;
}

/**
 * The trimmed first line of a version file, or null when it is missing or
 * empty. `TemplateVersionService` and `ArchiveTemplateInit` read versions with it.
 */
export function readFirstLine(file: string): string | null {
	try {
		return readFileSync(file, "utf8").split("\n", 1)[0]?.trim() || null;
	} catch {
		// One answer for "no file" and "no version". The caller names the file,
		// so the operator fixes the file.
		return null;
	}
}

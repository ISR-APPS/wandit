/**
 * Pure rules of a V2 desktop build (docs/v2/desktop-apps.md sections 8 to
 * 11): the status machine, the names of an app, and the key of the
 * credit hold. The desktop builds service, the repository, and the
 * `desktop-build` task call these functions. Nothing here does IO.
 */
import {
	type DesktopBuildStatus,
	liveDesktopBuildStatuses,
} from "@wandit/contracts";

/**
 * The statuses a row must hold before a compare-and-set to `to`. The
 * repository puts them in the WHERE clause, so a stale writer changes
 * nothing. A build that ended never moves again.
 */
export function desktopStatusesThatMayMoveTo(
	to: DesktopBuildStatus,
): DesktopBuildStatus[] {
	switch (to) {
		case "queued":
			return [];
		case "preparing":
			return ["queued"];
		// The gate runs in `preparing`: the build goes on to `building` or stops in `blocked`.
		case "building":
		case "blocked":
			return ["preparing"];
		case "signing":
			return ["building"];
		case "ready":
			return ["signing"];
		// The task fails a build and the API cancels it at any live step.
		case "failed":
		case "canceled":
			return [...liveDesktopBuildStatuses];
	}
}

/**
 * The statuses that the cancel route of the API may stop. Not `signing`: CI
 * is done and paid then, and a refund would make the signed installer free
 * (security audit A1). The task stop still cancels every live status.
 */
export const userCancelableDesktopBuildStatuses = [
	"queued",
	"preparing",
	"building",
] as const satisfies readonly DesktopBuildStatus[];

/**
 * 90 min. After this time in `signing`, the cancel route may stop the build.
 * The run is surely gone then: `maxDuration` is 80 min of compute, and the
 * signing step does not wait. So a crashed run never blocks the project.
 */
export const DESKTOP_SIGNING_STUCK_AFTER_MS = 90 * 60_000;

/**
 * Most live builds of one payer (the team org, or `projects.user_id` of a
 * personal project, also for a member's build), in all its projects. Zack's
 * rule: one payer must not fill the shared CI runners (security audit A6).
 * GitHub runs at most 5 macOS jobs at the same time on Free, Pro, and Team.
 */
export const MAX_LIVE_DESKTOP_BUILDS_PER_PAYER = 2;

/** Semver of one build: `1.0.<release number>`. NSIS packs each part as 16 bits. */
export function desktopVersion(releaseNumber: number): string {
	return `1.0.${releaseNumber}`;
}

/**
 * App identifier on both systems: `app.wandit.p` and the project id without
 * dashes. It names the data folder on the user machine, so it never changes.
 * On macOS it is also `CFBundleIdentifier` and the name of
 * `~/Library/Application Support/<identifier>`.
 */
export function desktopIdentifier(projectId: string): string {
	return `app.wandit.p${projectId.replaceAll("-", "").toLowerCase()}`;
}

/** Name of the app when the user gives none and the project name fails the rule. */
export const DEFAULT_DESKTOP_PRODUCT_NAME = "My App";

// Windows refuses these file names with any extension, so `con.exe` cannot exist.
const WINDOWS_RESERVED_NAMES = new Set([
	"con",
	"prn",
	"aux",
	"nul",
	...Array.from({ length: 9 }, (_, index) => `com${index + 1}`),
	...Array.from({ length: 9 }, (_, index) => `lpt${index + 1}`),
]);

/** Most characters of a binary name (section 8). */
const BINARY_NAME_MAX_LENGTH = 40;

/**
 * ASCII name of the exe and the installer file (section 8): NFKD, no
 * marks, lowercase, each run of other characters as one `-`, at most 40
 * characters. Empty gives `app`; a reserved Windows name gets `-app`.
 */
export function desktopBinaryName(productName: string): string {
	const name = productName
		.normalize("NFKD")
		.toLowerCase()
		.replace(/\p{M}/gu, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, BINARY_NAME_MAX_LENGTH)
		.replace(/-+$/, "");
	if (name === "") {
		return "app";
	}
	return WINDOWS_RESERVED_NAMES.has(name) ? `${name}-app` : name;
}

/**
 * Idempotency key of the credit hold of one build request. The API holds
 * with it; the `desktop-build` task settles or releases the same hold. The
 * project id keeps two projects apart, because the client picks the key.
 */
export function desktopBuildHoldKey(
	projectId: string,
	requestKey: string,
): string {
	return `desktop_build:${projectId}:${requestKey}`;
}

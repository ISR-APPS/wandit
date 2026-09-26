/**
 * Reads the template version of each platform once, at construction.
 * `AppProjectsService` stamps it on the project row and the builder session.
 * Line 1 of `templates/<framework>/template_version` is the version (D-D);
 * line 2 is the release date. The file paths come from `TEMPLATE_PROFILES`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import type { TargetPlatform } from "@wandit/contracts";

import { MobileTemplateUnavailableError } from "../../domain/errors/mobile-template-unavailable.error";
import { TEMPLATE_ARCHIVE_DIR } from "../sandbox/template-init";
import { TEMPLATE_PROFILES } from "../sandbox/template-profiles";

/**
 * The version file of each platform inside the `templates/` folder that
 * `TEMPLATE_ARCHIVE_DIR` finds from the working directory. A path built from
 * this source file breaks in the Railway bundle: `dist/main.mjs` sits 5
 * folders nearer the root.
 */
export const TEMPLATE_VERSION_FILE_PATHS: Readonly<
	Record<TargetPlatform, string>
> = {
	mobile: resolve(TEMPLATE_ARCHIVE_DIR, TEMPLATE_PROFILES.mobile.versionFile),
	web: resolve(TEMPLATE_ARCHIVE_DIR, TEMPLATE_PROFILES.web.versionFile),
};

/** Nest token carrying spec-provided file paths; production gets the real ones. */
export const TEMPLATE_VERSION_FILES = Symbol.for(
	"app-builder.template-version-files",
);

/**
 * The web file is required: a missing or empty one throws at construction.
 * The mobile file is optional. Without it, the API boots. Each mobile create
 * then answers 503 until a boot finds the file.
 */
@Injectable()
export class TemplateVersionService {
	private readonly logger = new Logger(TemplateVersionService.name);
	// "web-app@1.0.0": line 1 of the web version file.
	private readonly webVersion: string;
	// "mobile-app@1.0.0", or null when the mobile file was absent at boot.
	private readonly mobileVersion: string | null;

	constructor(
		@Optional()
		@Inject(TEMPLATE_VERSION_FILES)
		files: Readonly<
			Record<TargetPlatform, string>
		> = TEMPLATE_VERSION_FILE_PATHS,
	) {
		const webVersion = readFirstLine(files.web);
		if (webVersion === null) {
			throw new Error(
				`templates/web-app/template_version is missing or empty at ${files.web}`,
			);
		}
		this.webVersion = webVersion;
		this.mobileVersion = readFirstLine(files.mobile);
		if (this.mobileVersion === null) {
			this.logger.warn(
				`templates/mobile-app/template_version is missing or empty at ${files.mobile}; a mobile create answers MOBILE_TEMPLATE_UNAVAILABLE`,
			);
		}
	}

	/**
	 * The version a new project of this platform starts from. Throws
	 * `MobileTemplateUnavailableError` (503) when the mobile file was absent at boot.
	 */
	versionFor(platform: TargetPlatform): string {
		if (platform === "web") {
			return this.webVersion;
		}
		if (this.mobileVersion === null) {
			throw new MobileTemplateUnavailableError();
		}
		return this.mobileVersion;
	}
}

/** The trimmed first line of the file, or null when it is missing or empty. */
function readFirstLine(file: string): string | null {
	try {
		return readFileSync(file, "utf8").split("\n", 1)[0]?.trim() || null;
	} catch {
		// One answer for "no file" and "no version". The caller names the file,
		// so the operator fixes the file.
		return null;
	}
}

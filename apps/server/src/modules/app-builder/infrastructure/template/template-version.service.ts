/**
 * Reads the web-app template version once at construction.
 * `AppProjectsService` stamps it on the project row and the builder session;
 * the file `templates/web-app/template_version` is the single source (D-D:
 * line 1 is the version, line 2 is the release date).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Inject, Injectable, Optional } from "@nestjs/common";

import { TEMPLATE_ARCHIVE_DIR } from "../sandbox/template-init";

/**
 * The version file inside the `templates/` folder that `TEMPLATE_ARCHIVE_DIR`
 * finds from the working directory. A path built from this source file
 * breaks in the Railway bundle: `dist/main.mjs` sits 5 folders nearer the root.
 */
export const TEMPLATE_VERSION_FILE_PATH = resolve(
	TEMPLATE_ARCHIVE_DIR,
	"web-app/template_version",
);

/** Nest token carrying a spec-provided file path; production gets the real one. */
export const TEMPLATE_VERSION_FILE = Symbol.for(
	"app-builder.template-version-file",
);

/** Reads the file once; a missing or empty file throws at construction. */
@Injectable()
export class TemplateVersionService {
	// "web-app@1.0.0": the first line of the file; the second line is the
	// release date.
	readonly current: string;

	constructor(
		@Optional()
		@Inject(TEMPLATE_VERSION_FILE)
		file: string = TEMPLATE_VERSION_FILE_PATH,
	) {
		let firstLine: string | undefined;
		try {
			firstLine = readFileSync(file, "utf8").split("\n", 1)[0]?.trim();
		} catch {
			// One message for "no file" and "no version": the operator fixes
			// the file, not the error string.
			firstLine = undefined;
		}
		if (!firstLine) {
			throw new Error(
				`templates/web-app/template_version is missing or empty at ${file}`,
			);
		}
		this.current = firstLine;
	}
}

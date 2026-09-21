/**
 * Reads the web-app template version once at construction.
 * `AppProjectsService` stamps it on the project row and the builder session;
 * the file `templates/web-app/template_version` is the single source (D-D:
 * line 1 is the version, line 2 is the release date).
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Inject, Injectable, Optional } from "@nestjs/common";

/**
 * The version file, resolved against the repo root like
 * `TEMPLATE_ARCHIVE_DIR` does. Bundled worker layouts can move it —
 * WANDIT-168 verifies the path where the tasks actually run.
 */
export const TEMPLATE_VERSION_FILE_PATH = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../../../../../../../templates/web-app/template_version",
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

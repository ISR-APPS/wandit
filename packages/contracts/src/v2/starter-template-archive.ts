/**
 * The `manifest.json` of a starter template archive `templates/starter-<id>.tar.gz`.
 * `templates/starters/scripts/pack.mjs` writes the file. The API task `apply-starter-template`
 * parses it before it deletes a path in the project sandbox.
 * Import it by subpath only: "@wandit/contracts/v2/starter-template-archive". The web does not use it.
 */
import { z } from "zod";
import { starterTemplateIdSchema } from "../v1/shared/primitives";

// One path segment: letters, digits, and the marks that route and config file names use.
// It allows no "/", no "\", no space, and no control character such as NUL.
const PATH_SEGMENT = "[A-Za-z0-9._$()\\[\\]@+-]+";
// A segment that is only "." or ".." leaves the folder, so the pattern refuses it.
const SAFE_SEGMENT = `(?!\\.{1,2}(?:/|$))${PATH_SEGMENT}`;

// A path from the project root, with "/" separators. Security check: the apply task gives each
// path to `rm` in the sandbox, so a path must stay in the project and must not touch `.git`.
const removedPathSchema = z
	.string()
	// 512 characters: longer than each path of the base template, shorter than the Linux path limit.
	.max(512)
	.regex(
		new RegExp(`^(?!\\.git(?:/|$))${SAFE_SEGMENT}(?:/${SAFE_SEGMENT})*$`, "u"),
	);

/** The content of `manifest.json` at the archive root. `files/` next to it holds the overlay tree. */
export const starterTemplateManifestSchema = z.object({
	// The id of the starter template. The apply task refuses an archive whose id is not the id it asked for.
	id: starterTemplateIdSchema,
	// Base template files and folders that the starter template deletes.
	// 500 entries: the base template has about 250 files.
	removed: z.array(removedPathSchema).max(500),
});

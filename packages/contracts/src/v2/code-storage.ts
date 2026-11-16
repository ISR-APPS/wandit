/**
 * Schemas of the code.storage REST answers that the server reads.
 * `CodeStorageGitStore` in apps/server parses `GET /repos/files` with them.
 * The other code.storage calls answer bytes or a problem body.
 */
import { z } from "zod";

/**
 * Answer of `GET /repos/files?ref=&limit=`: the entries of the git tree at
 * `ref`. The server reads only `path` and `type`, and zod drops other keys.
 */
export const codeStorageFileListResponseSchema = z.object({
	entries: z.array(
		z.object({
			/** Path from the repository root, for example "src/app.tsx". */
			path: z.string(),
			/**
			 * "blob" for a file. The API also answers "tree", "symlink", and
			 * "submodule". A plain string keeps a new type from failing the parse.
			 */
			type: z.string(),
		}),
	),
});

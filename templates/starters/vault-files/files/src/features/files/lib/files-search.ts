// The URL state of the Files page: the open folder, the view, the type filter, and the sort.
// The /app/files route validates the search params with this schema. A bad value falls back to the default.
import { z } from "zod";
import { FILE_CATEGORIES } from "~/features/workspace";

/** The two layouts of the browser. */
export const FILE_VIEWS = ["list", "grid"] as const;

/** The sort orders of the browser. Folders always come first, by name. */
export const FILE_SORTS = ["modified", "name", "size"] as const;

/** One sort order. Its label is the message key `files.sorts.<sort>`. */
export type FileSort = (typeof FILE_SORTS)[number];

/** Search params of /app/files. Each field is optional: no folder is the top of the workspace. */
export const filesSearchSchema = z.object({
	folder: z.string().max(80).optional().catch(undefined),
	view: z.enum(FILE_VIEWS).optional().catch(undefined),
	type: z.enum(FILE_CATEGORIES).optional().catch(undefined),
	sort: z.enum(FILE_SORTS).optional().catch(undefined),
});

/** The parsed search params of /app/files. */
export type FilesSearch = z.infer<typeof filesSearchSchema>;

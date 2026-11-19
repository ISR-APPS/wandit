// The URL state of the Files page: the open folder and the type filter.
// The /app/files route validates the search params with this schema. A bad value falls back to the default.
// The home type cards link here with `type`; the folder cards and the breadcrumb link here with `folder`.
import { z } from "zod";
import { FILE_CATEGORIES } from "~/features/workspace";

/** The sort keys of the browser. Folders always come first, by name. */
export const FILE_SORTS = ["name", "modified", "size"] as const;

/** One sort key. Its label is the message key `files.sorts.<sort>`. */
export type FileSort = (typeof FILE_SORTS)[number];

/** The sort of the browser: a key and a direction. The page holds it in state, as the kit does. */
export type FileSortState = {
	by: FileSort;
	direction: "ascending" | "descending";
};

/** Search params of /app/files. Each field is optional: no folder is the top of the workspace. */
export const filesSearchSchema = z.object({
	folder: z.string().max(80).optional().catch(undefined),
	type: z.enum(FILE_CATEGORIES).optional().catch(undefined),
});

/** The parsed search params of /app/files. */
export type FilesSearch = z.infer<typeof filesSearchSchema>;

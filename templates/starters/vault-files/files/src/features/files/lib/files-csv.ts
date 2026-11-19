// The CSV columns of the Files page export: one line per folder or file row of the open folder.
// FilesPage calls entryCsvColumns in the click handler of "Export CSV" and of "Export selected".
import type { CsvColumn } from "~/features/workspace";
import { formatBytes } from "~/features/workspace";
import type { TranslationKey } from "~/shared/i18n";
import type { BrowseEntry } from "./browse";

/** The columns: name, type, size, last change, and owner (empty for a folder). */
export function entryCsvColumns(
	t: (key: TranslationKey) => string,
	locale: string,
): CsvColumn<BrowseEntry>[] {
	return [
		{
			header: t("files.columns.name"),
			value: (row) => (row.type === "folder" ? row.folder.name : row.file.name),
		},
		{
			header: t("files.columns.type"),
			value: (row) =>
				row.type === "folder"
					? t("files.folder")
					: t(`fileKinds.${row.file.kind}`),
		},
		{
			header: t("files.columns.size"),
			value: (row) =>
				formatBytes(
					row.type === "folder" ? row.sizeBytes : row.file.sizeBytes,
					locale,
				),
		},
		{
			header: t("files.columns.modified"),
			value: (row) =>
				(row.type === "folder" ? row.modifiedAt : row.file.modifiedAt) ?? "",
		},
		{
			header: t("files.columns.owner"),
			value: (row) => (row.type === "folder" ? "" : row.file.ownerName),
		},
	];
}

// The list layout of the Files page: one table row per folder or file, 20 rows per page.
// FilesPage renders it with the rows of browseFolder. The rows arrive sorted, so the headers do not sort.
import { LinkSimpleIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import {
	FileNameCell,
	fillCount,
	formatBytes,
	formatRelativeTime,
	MemberAvatar,
	pluralForm,
} from "~/features/workspace";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";
import type { BrowseEntry } from "../lib/browse";
import { FolderMark } from "./folder-mark";

type FilesListViewProps = {
	entries: BrowseEntry[];
	/** True in a search or a type filter: each file then shows its folder path. */
	showPaths: boolean;
	/** The text of a search with no match. */
	noResults: string;
};

/** The table of the list layout. The name cell links a folder to its view and a file to its page. */
export function FilesListView({
	entries,
	showPaths,
	noResults,
}: FilesListViewProps) {
	const { t, locale } = useT();
	const now = Date.now();

	const columns: DataTableColumn<BrowseEntry>[] = [
		{
			id: "name",
			header: t("files.columns.name"),
			cell: (entry) =>
				entry.type === "folder" ? (
					<div className="flex min-w-44 items-center gap-3">
						<FolderMark />
						<div className="grid min-w-0 justify-items-start">
							<Link
								to="/app/files"
								search={(previous) => ({
									...previous,
									folder: entry.folder.id,
								})}
								className="max-w-full truncate font-medium hover:underline"
								dir="auto"
							>
								{entry.folder.name}
							</Link>
							<span className="text-muted-foreground text-xs">
								{fillCount(
									t(`files.fileCount.${pluralForm(entry.fileCount, locale)}`),
									entry.fileCount,
									locale,
								)}
							</span>
						</div>
					</div>
				) : (
					<FileNameCell
						fileId={entry.file.id}
						name={entry.file.name}
						kind={entry.file.kind}
						path={entry.file.path}
						detail={
							showPaths
								? undefined
								: `${t(`fileKinds.${entry.file.kind}`)} · ${fillCount(
										t(
											`files.versionCount.${pluralForm(entry.file.versionCount, locale)}`,
										),
										entry.file.versionCount,
										locale,
									)}`
						}
					/>
				),
		},
		{
			id: "owner",
			header: t("files.columns.owner"),
			cell: (entry) =>
				entry.type === "folder" ? (
					<span className="text-muted-foreground">
						{t(`teams.${entry.folder.team}`)}
					</span>
				) : (
					<span className="flex items-center gap-2 whitespace-nowrap">
						<MemberAvatar name={entry.file.ownerName} />
						{entry.file.ownerName}
					</span>
				),
		},
		{
			id: "modified",
			header: t("files.columns.modified"),
			cell: (entry) => {
				const modifiedAt =
					entry.type === "folder" ? entry.modifiedAt : entry.file.modifiedAt;
				return (
					<span className="whitespace-nowrap text-muted-foreground">
						{modifiedAt ? formatRelativeTime(modifiedAt, now, locale) : "–"}
					</span>
				);
			},
		},
		{
			id: "sharing",
			header: t("files.columns.sharing"),
			cell: (entry) =>
				entry.type === "folder" ? (
					<span className="text-muted-foreground">–</span>
				) : entry.file.liveShareCount > 0 ? (
					<Badge variant="info">
						<LinkSimpleIcon />
						{t("files.shared")}
					</Badge>
				) : (
					<Badge variant="secondary">{t("files.teamOnly")}</Badge>
				),
		},
		{
			id: "size",
			header: t("files.columns.size"),
			align: "end",
			cell: (entry) =>
				formatBytes(
					entry.type === "folder" ? entry.sizeBytes : entry.file.sizeBytes,
					locale,
				),
		},
	];

	return <DataTable rows={entries} columns={columns} noResults={noResults} />;
}

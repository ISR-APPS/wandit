// The file browser behind login: the folder trail, the toolbar, and the folder rows as a list or a grid.
// The /app/files route renders it after its loader and passes the parsed search params.
// The open folder, the view, the type filter, and the sort sit in the URL. The search text stays in the page.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { fillCount, formatBytes, pluralForm } from "~/features/workspace";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import { filesQueryOptions } from "../api/files.queries";
import { browseFolder, folderTrail } from "../lib/browse";
import type { FilesSearch } from "../lib/files-search";
import { FilesGridView } from "./files-grid-view";
import { FilesListView } from "./files-list-view";
import { FilesToolbar } from "./files-toolbar";
import { FolderBreadcrumb } from "./folder-breadcrumb";

type FilesPageProps = {
	/** The validated search params of /app/files. */
	search: FilesSearch;
};

/** The browser. browseFolder derives the rows during render from the list query and the URL state. */
export function FilesPage({ search }: FilesPageProps) {
	const { t, locale } = useT();
	const navigate = useNavigate();
	const { data } = useSuspenseQuery(filesQueryOptions());
	const [query, setQuery] = useState("");

	const folderId = search.folder ?? null;
	const view = search.view ?? "list";
	const sort = search.sort ?? "modified";
	const trail = folderTrail(data.folders, folderId);
	const folder = trail[trail.length - 1];

	// An id in the URL that matches no folder: the link is old or wrong.
	if (folderId !== null && !folder) {
		return (
			<div className="grid justify-items-start gap-4">
				<PageHeader title={t("files.title")} />
				<p className="text-muted-foreground text-sm">
					{t("files.folderNotFound")}
				</p>
				<Button asChild variant="outline">
					<Link to="/app/files">{t("files.backToAll")}</Link>
				</Button>
			</div>
		);
	}

	const { entries, isFiltered } = browseFolder(
		data.files,
		data.folders,
		folderId,
		{
			query,
			category: search.type,
			sort,
			locale,
		},
	);
	// The header totals count everything under the open folder, also in its sub-folders.
	const under = browseFolder(data.files, data.folders, folderId, {
		query: "",
		category: undefined,
		sort,
		locale,
	});
	const folderCount = under.entries.filter(
		(entry) => entry.type === "folder",
	).length;
	const totals = under.entries.reduce(
		(sum, entry) =>
			entry.type === "folder"
				? {
						files: sum.files + entry.fileCount,
						bytes: sum.bytes + entry.sizeBytes,
					}
				: { files: sum.files + 1, bytes: sum.bytes + entry.file.sizeBytes },
		{ files: 0, bytes: 0 },
	);
	const fileCount = entries.length;
	const scopeName = folder?.name ?? t("files.allFiles");
	const noResults = t(isFiltered ? "files.noMatch" : "files.emptyFolder");

	function updateSearch(next: Partial<FilesSearch>) {
		void navigate({ to: "/app/files", search: { ...search, ...next } });
	}

	return (
		<div className="grid gap-6">
			<PageHeader
				title={folder?.name ?? t("files.title")}
				description={[
					...(folderCount > 0
						? [
								fillCount(
									t(`files.folderCount.${pluralForm(folderCount, locale)}`),
									folderCount,
									locale,
								),
							]
						: []),
					fillCount(
						t(`files.fileCount.${pluralForm(totals.files, locale)}`),
						totals.files,
						locale,
					),
					formatBytes(totals.bytes, locale),
					// The home counts the trash in storage. The top folder names it, so the two totals agree.
					...(folderId === null && data.trashBytes > 0
						? [
								t("files.inTrash").replace(
									"{size}",
									formatBytes(data.trashBytes, locale),
								),
							]
						: []),
				].join(" · ")}
			/>
			<Card className="gap-4">
				<CardContent className="grid gap-4">
					<FolderBreadcrumb trail={trail} />
					<FilesToolbar
						query={query}
						onQueryChange={setQuery}
						category={search.type}
						onCategoryChange={(type) => updateSearch({ type })}
						sort={sort}
						onSortChange={(next) =>
							updateSearch({ sort: next === "modified" ? undefined : next })
						}
						view={view}
						onViewChange={(next) =>
							updateSearch({ view: next === "list" ? undefined : next })
						}
					/>
					{isFiltered ? (
						<p className="text-muted-foreground text-sm" aria-live="polite">
							{fillCount(
								t(`files.matchCount.${pluralForm(fileCount, locale)}`),
								fileCount,
								locale,
							).replace("{scope}", scopeName)}
						</p>
					) : null}
					{view === "grid" ? (
						<FilesGridView
							key={`${folderId}-${query}-${search.type}-${sort}`}
							entries={entries}
							noResults={noResults}
						/>
					) : (
						<FilesListView
							entries={entries}
							showPaths={isFiltered}
							noResults={noResults}
						/>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8"];

/** Placeholder while the list loader runs. The route sets it as pendingComponent. */
export function FilesPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-4 w-64" />
			</div>
			<Card>
				<CardContent className="grid gap-3">
					<Skeleton className="h-5 w-32" />
					<Skeleton className="h-9 w-full sm:max-w-md" />
					{SKELETON_ROWS.map((key) => (
						<Skeleton key={key} className="h-11 w-full" />
					))}
				</CardContent>
			</Card>
		</div>
	);
}

/** Error state of the Files routes when a loader fails. Try again runs the loader again. */
export function FilesPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("files.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}

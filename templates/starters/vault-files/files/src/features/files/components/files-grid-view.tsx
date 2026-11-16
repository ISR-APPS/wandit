// The grid layout of the Files page: the folders as short cards, then the files as preview cards.
// FilesPage renders it with the rows of browseFolder, and a new key for each folder, so "Show more" starts over.
// The files show 30 cards first, then "Show more". The folders always show in full.
import { LinkSimpleIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
	fillCount,
	formatBytes,
	formatRelativeTime,
	pluralForm,
} from "~/features/workspace";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import type { BrowseEntry } from "../lib/browse";
import { FilePreview } from "./file-preview";
import { FolderMark } from "./folder-mark";

// Full rows at 2, 3, 5, and 6 columns. A large folder adds more with "Show more".
const GRID_PAGE = 30;

type FilesGridViewProps = {
	entries: BrowseEntry[];
	/** The text of a search with no match. */
	noResults: string;
};

/** Two card groups. Each card is one link, so the whole card opens the folder or the file page. */
export function FilesGridView({ entries, noResults }: FilesGridViewProps) {
	const { t, locale } = useT();
	const [shownCount, setShownCount] = useState(GRID_PAGE);
	const now = Date.now();
	const folders = entries.flatMap((entry) =>
		entry.type === "folder" ? [entry] : [],
	);
	const files = entries.flatMap((entry) =>
		entry.type === "file" ? [entry.file] : [],
	);
	const shownFiles = files.slice(0, shownCount);

	if (entries.length === 0) {
		return (
			<p className="py-10 text-center text-muted-foreground text-sm">
				{noResults}
			</p>
		);
	}

	const cardClass =
		"group min-w-0 rounded-lg border bg-card p-3 transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring";
	const headingClass = "font-medium font-sans text-muted-foreground text-xs";

	return (
		<div className="grid gap-6">
			{folders.length > 0 ? (
				<section className="grid gap-3">
					<h2 className={headingClass}>{t("files.groups.folders")}</h2>
					<ul className="grid @3xl/main:grid-cols-3 @5xl/main:grid-cols-4 grid-cols-2 gap-3">
						{folders.map((entry) => (
							<li key={entry.id} className="min-w-0">
								<Link
									to="/app/files"
									search={(previous) => ({
										...previous,
										folder: entry.folder.id,
									})}
									// A phone has two narrow columns, so the mark sits above the name there.
									className={`${cardClass} flex @lg/main:flex-row flex-col items-start @lg/main:items-center gap-3`}
								>
									<FolderMark />
									<span className="grid min-w-0 gap-0.5">
										<span className="truncate font-medium text-sm" dir="auto">
											{entry.folder.name}
										</span>
										<span className="truncate text-muted-foreground text-xs tabular-nums">
											{`${fillCount(
												t(
													`files.fileCount.${pluralForm(entry.fileCount, locale)}`,
												),
												entry.fileCount,
												locale,
											)} · ${formatBytes(entry.sizeBytes, locale)}`}
										</span>
									</span>
								</Link>
							</li>
						))}
					</ul>
				</section>
			) : null}
			{files.length > 0 ? (
				<section className="grid gap-3">
					<h2 className={headingClass}>{t("files.groups.files")}</h2>
					{/* No 4-column step, so GRID_PAGE fills every row at each width. */}
					<ul className="grid @4xl/main:grid-cols-5 @7xl/main:grid-cols-6 @lg/main:grid-cols-3 grid-cols-2 gap-3">
						{shownFiles.map((file) => (
							<li key={file.id} className="min-w-0">
								<Link
									to="/app/files/$fileId"
									params={{ fileId: file.id }}
									className={`${cardClass} grid gap-3`}
								>
									<span className="relative flex">
										<FilePreview file={file} />
										<span className="absolute end-2 bottom-2 rounded-sm bg-card px-1.5 py-0.5 font-medium text-[0.6875rem] text-muted-foreground">
											{file.extension}
										</span>
										{file.liveShareCount > 0 ? (
											<span
												role="img"
												aria-label={t("files.shared")}
												className="absolute start-2 top-2 inline-flex size-6 items-center justify-center rounded-full bg-card text-info [&_svg]:size-3.5"
											>
												<LinkSimpleIcon />
											</span>
										) : null}
									</span>
									<span className="grid min-w-0 gap-0.5">
										<span className="truncate font-medium text-sm" dir="auto">
											{file.name}
										</span>
										<span className="truncate text-muted-foreground text-xs tabular-nums">
											{`${formatBytes(file.sizeBytes, locale)} · ${formatRelativeTime(file.modifiedAt, now, locale)}`}
										</span>
									</span>
								</Link>
							</li>
						))}
					</ul>
				</section>
			) : null}
			{files.length > shownCount ? (
				<div className="flex flex-wrap items-center justify-center gap-3">
					<p className="text-muted-foreground text-sm tabular-nums">
						{t("files.shownOf")
							.replace(
								"{shown}",
								new Intl.NumberFormat(locale).format(shownFiles.length),
							)
							.replace(
								"{total}",
								new Intl.NumberFormat(locale).format(files.length),
							)}
					</p>
					<Button
						type="button"
						variant="outline"
						className="max-sm:min-h-11"
						onClick={() => setShownCount((count) => count + GRID_PAGE)}
					>
						{t("files.showMore")}
					</Button>
				</div>
			) : null}
		</div>
	);
}

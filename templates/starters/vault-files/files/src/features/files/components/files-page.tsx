// The file browser behind login, in the shape of the kit file manager app:
// a title row with the folder trail, a toolbar (select all, bulk menu, search, sort), the rows, and a pager.
// A picked file opens FileDetailsPanel at the end side on wide screens. The /app/files route renders the page
// with a key per folder and type, so the search, the selection, and the page reset when the folder changes.
import {
	DotsThreeIcon,
	DownloadSimpleIcon,
	FileIcon,
	FolderSimpleIcon,
	InfoIcon,
	LinkSimpleIcon,
} from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import {
	copyToClipboard,
	downloadCsv,
	FileTile,
	fileUrl,
	folderUrl,
	formatBytes,
	MemberAvatar,
	toCsv,
} from "~/features/workspace";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { Checkbox } from "~/shared/ui/checkbox";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "~/shared/ui/dropdown-menu";
import {
	CaretDownIcon,
	CaretLeftIcon,
	CaretRightIcon,
	XIcon,
} from "~/shared/ui/icons";
import { Input } from "~/shared/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Separator } from "~/shared/ui/separator";
import { Skeleton } from "~/shared/ui/skeleton";
import { filesQueryOptions } from "../api/files.queries";
import { type BrowseEntry, browseFolder, folderTrail } from "../lib/browse";
import { entryCsvColumns } from "../lib/files-csv";
import {
	FILE_SORTS,
	type FileSortState,
	type FilesSearch,
} from "../lib/files-search";
import { FileDetailsPanel } from "./file-details-panel";
import { FolderBreadcrumb } from "./folder-breadcrumb";
import { FolderMark } from "./folder-mark";

// The rows-per-page choices of the pager. 25 is the default, as in the kit.
const PAGE_SIZES = [10, 25, 50] as const;

type FilesPageProps = {
	/** The validated search params of /app/files. */
	search: FilesSearch;
};

/** The browser. browseFolder derives the rows during render from the list query, the URL, and the page state. */
export function FilesPage({ search }: FilesPageProps) {
	const { t, locale } = useT();
	const { data } = useSuspenseQuery(filesQueryOptions());
	const [query, setQuery] = useState("");
	const [sort, setSort] = useState<FileSortState>({
		by: "name",
		direction: "ascending",
	});
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[1]);
	const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
		new Set(),
	);
	const [pickedFileId, setPickedFileId] = useState<string | null>(null);

	const folderId = search.folder ?? null;
	const trail = folderTrail(data.folders, folderId);
	const number = new Intl.NumberFormat(locale);
	const dayFormat = new Intl.DateTimeFormat(locale, { dateStyle: "short" });

	// An id in the URL that matches no folder: the link is old or wrong.
	if (folderId !== null && trail.length === 0) {
		return (
			<div className="grid justify-items-start gap-4">
				<FilesTitle trail={[]} />
				<p className="text-muted-foreground text-sm">
					{t("files.folderNotFound")}
				</p>
				<Button asChild variant="outline">
					<Link to="/app/files">{t("files.backToAll")}</Link>
				</Button>
			</div>
		);
	}

	const { entries } = browseFolder(data.files, data.folders, folderId, {
		query,
		category: search.type,
		sort,
		locale,
	});
	// LIMIT: pages in the browser over the whole list query (about 1,000 files). Upgrade: server paging with .range().
	const pageCount = Math.max(1, Math.ceil(entries.length / pageSize));
	// A new search can shrink the list below the current page, so clamp here.
	const currentPage = Math.min(page, pageCount);
	const firstIndex = (currentPage - 1) * pageSize;
	const pageRows = entries.slice(firstIndex, firstIndex + pageSize);
	const selectedRows = entries.filter((entry) => selectedIds.has(entry.id));
	const pageSelectedCount = pageRows.filter((entry) =>
		selectedIds.has(entry.id),
	).length;
	const pickedFile = data.files.find((file) => file.id === pickedFileId);

	function setRowsSelected(ids: string[], isSelected: boolean) {
		setSelectedIds((current) => {
			const next = new Set(current);
			for (const id of ids) {
				if (isSelected) {
					next.add(id);
				} else {
					next.delete(id);
				}
			}
			return next;
		});
	}

	// A second pick of the active key flips the direction, as in the kit sort menu.
	function pickSort(by: FileSortState["by"]) {
		setSort((current) =>
			current.by === by
				? {
						by,
						direction:
							current.direction === "ascending" ? "descending" : "ascending",
					}
				: { by, direction: "ascending" },
		);
	}

	function exportRows(rows: BrowseEntry[], fileName: string) {
		downloadCsv(fileName, toCsv(rows, entryCsvColumns(t, locale)));
	}

	const arrow = sort.direction === "ascending" ? "↑" : "↓";

	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<FilesTitle trail={trail} />
				<Button
					type="button"
					aria-label={t("common.exportCsv")}
					onClick={() => exportRows(entries, "files.csv")}
				>
					<DownloadSimpleIcon />
					<span className="hidden lg:inline">{t("common.exportCsv")}</span>
				</Button>
			</div>
			<div className="flex min-w-0 border-t">
				<div className="min-w-0 grow">
					<div className="flex items-center justify-between gap-2 border-b p-2 pe-1 lg:p-4">
						<div className="flex min-w-0 grow items-center gap-2">
							<Checkbox
								aria-label={t("table.selectPage")}
								checked={
									pageRows.length > 0 && pageSelectedCount === pageRows.length
										? true
										: pageSelectedCount > 0
											? "indeterminate"
											: false
								}
								onCheckedChange={(checked) =>
									setRowsSelected(
										pageRows.map((entry) => entry.id),
										checked === true,
									)
								}
								className="ms-2"
							/>
							{selectedRows.length > 0 ? (
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button
											variant="ghost"
											size="icon"
											aria-label={t("files.bulkActions")}
										>
											<CaretDownIcon />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="start" className="min-w-44">
										<DropdownMenuItem
											onSelect={() =>
												exportRows(selectedRows, "files-selected.csv")
											}
										>
											<DownloadSimpleIcon />
											{t("table.exportSelected")}
										</DropdownMenuItem>
										<DropdownMenuItem
											onSelect={() => setSelectedIds(new Set())}
										>
											<XIcon />
											{t("files.clearSelection")}
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							) : null}
							<Input
								type="search"
								value={query}
								onChange={(event) => {
									setQuery(event.target.value);
									setPage(1);
								}}
								placeholder={t("files.searchPlaceholder")}
								aria-label={t("files.searchPlaceholder")}
								className="border-0 bg-transparent shadow-none focus-visible:ring-0"
							/>
						</div>
						{search.type ? (
							<Badge variant="secondary" asChild>
								<Link
									to="/app/files"
									search={{ folder: search.folder }}
									aria-label={`${t("files.clearType")}: ${t(`fileCategories.${search.type}`)}`}
								>
									{t(`fileCategories.${search.type}`)}
									<XIcon />
								</Link>
							</Badge>
						) : null}
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" className="shrink-0">
									{`${t("files.sort")}: ${t(`files.sorts.${sort.by}`)} ${arrow}`}
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="min-w-44">
								{FILE_SORTS.map((by) => (
									<DropdownMenuItem
										key={by}
										role="menuitemradio"
										aria-checked={sort.by === by}
										onSelect={() => pickSort(by)}
										className="justify-between"
									>
										{t(`files.sorts.${by}`)}
										{sort.by === by ? (
											<span className="text-xs">{arrow}</span>
										) : null}
									</DropdownMenuItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
					{pageRows.length === 0 ? (
						<p className="p-8 text-center text-muted-foreground text-sm">
							{query || search.type
								? t("files.noMatch")
								: t("files.emptyFolder")}
						</p>
					) : (
						<ul>
							{pageRows.map((entry) => {
								const isSelected = selectedIds.has(entry.id);
								const isPicked =
									entry.type === "file" && entry.id === pickedFileId;
								const name =
									entry.type === "folder" ? entry.folder.name : entry.file.name;
								const modifiedAt =
									entry.type === "folder"
										? entry.modifiedAt
										: entry.file.modifiedAt;
								return (
									<li
										key={entry.id}
										data-state={isSelected ? "selected" : undefined}
										className={cn(
											"flex items-center justify-between gap-4 border-b px-2 py-3 hover:bg-muted lg:px-4",
											(isSelected || isPicked) && "bg-muted",
										)}
									>
										<div className="flex min-w-0 items-center gap-4">
											<Checkbox
												aria-label={`${t("table.selectRow")}: ${name}`}
												checked={isSelected}
												onCheckedChange={(checked) =>
													setRowsSelected([entry.id], checked === true)
												}
												className="ms-2"
											/>
											{entry.type === "folder" ? (
												<FolderMark size="xs" />
											) : (
												<FileTile kind={entry.file.kind} size="xs" />
											)}
											{entry.type === "folder" ? (
												<Link
													to="/app/files"
													search={{ folder: entry.id }}
													className="truncate hover:underline"
													dir="auto"
												>
													{name}
												</Link>
											) : (
												<>
													{/* Wide screens: the name opens the side panel. Narrow screens: it opens the file page. */}
													<button
														type="button"
														onClick={() => setPickedFileId(entry.id)}
														className="hidden truncate text-start hover:underline xl:block"
														dir="auto"
													>
														{name}
													</button>
													<Link
														to="/app/files/$fileId"
														params={{ fileId: entry.id }}
														className="truncate hover:underline xl:hidden"
														dir="auto"
													>
														{name}
													</Link>
												</>
											)}
										</div>
										<div className="flex shrink-0 items-center gap-4 text-muted-foreground text-sm">
											<span className="hidden w-20 text-end tabular-nums lg:inline">
												{modifiedAt
													? dayFormat.format(new Date(modifiedAt))
													: ""}
											</span>
											<span className="hidden w-16 text-end tabular-nums lg:inline">
												{formatBytes(
													entry.type === "folder"
														? entry.sizeBytes
														: entry.file.sizeBytes,
													locale,
												)}
											</span>
											<MemberAvatar
												name={
													entry.type === "folder"
														? t(`teams.${entry.folder.team}`)
														: entry.file.ownerName
												}
											/>
											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<Button
														variant="ghost"
														size="icon"
														className="size-8"
														aria-label={`${t("table.rowActions")}: ${name}`}
													>
														<DotsThreeIcon className="size-4" />
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end" className="min-w-40">
													{entry.type === "folder" ? (
														<DropdownMenuItem asChild>
															<Link
																to="/app/files"
																search={{ folder: entry.id }}
															>
																<FolderSimpleIcon />
																{t("files.open")}
															</Link>
														</DropdownMenuItem>
													) : (
														<>
															<DropdownMenuItem asChild>
																<Link
																	to="/app/files/$fileId"
																	params={{ fileId: entry.id }}
																>
																	<FileIcon />
																	{t("files.open")}
																</Link>
															</DropdownMenuItem>
															<DropdownMenuItem
																className="hidden xl:flex"
																onSelect={() => setPickedFileId(entry.id)}
															>
																<InfoIcon />
																{t("files.details")}
															</DropdownMenuItem>
														</>
													)}
													<DropdownMenuItem
														onSelect={() =>
															copyToClipboard(
																entry.type === "folder"
																	? folderUrl(entry.id)
																	: fileUrl(entry.id),
																{
																	done: t("table.copied"),
																	failed: t("table.copyFailed"),
																},
															)
														}
													>
														<LinkSimpleIcon />
														{t("files.copyLink")}
													</DropdownMenuItem>
												</DropdownMenuContent>
											</DropdownMenu>
										</div>
									</li>
								);
							})}
						</ul>
					)}
					<div className="flex flex-wrap items-center justify-between gap-4 pt-4 lg:gap-8">
						<div className="flex items-center gap-3">
							<span className="hidden text-sm lg:inline">
								{t("files.rowsPerPage")}
							</span>
							<Select
								value={String(pageSize)}
								onValueChange={(value) => {
									setPageSize(Number(value));
									setPage(1);
								}}
							>
								<SelectTrigger
									className="w-fit"
									aria-label={t("files.rowsPerPage")}
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{PAGE_SIZES.map((size) => (
										<SelectItem key={size} value={String(size)}>
											{number.format(size)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="flex grow items-center justify-end gap-2">
							<p className="me-2 text-muted-foreground text-sm tabular-nums">
								{t("table.range")
									.replace(
										"{from}",
										number.format(pageRows.length === 0 ? 0 : firstIndex + 1),
									)
									.replace("{to}", number.format(firstIndex + pageRows.length))
									.replace("{count}", number.format(entries.length))}
							</p>
							<PagerButton
								label={t("files.firstPage")}
								disabled={currentPage === 1}
								onClick={() => setPage(1)}
							>
								<CaretLeftIcon className="rtl:rotate-180" />
								<CaretLeftIcon className="-ms-3 rtl:rotate-180" />
							</PagerButton>
							<PagerButton
								label={t("table.previous")}
								disabled={currentPage === 1}
								onClick={() => setPage(currentPage - 1)}
							>
								<CaretLeftIcon className="rtl:rotate-180" />
							</PagerButton>
							<PagerButton
								label={t("table.next")}
								disabled={currentPage === pageCount}
								onClick={() => setPage(currentPage + 1)}
							>
								<CaretRightIcon className="rtl:rotate-180" />
							</PagerButton>
							<PagerButton
								label={t("files.lastPage")}
								disabled={currentPage === pageCount}
								onClick={() => setPage(pageCount)}
							>
								<CaretRightIcon className="rtl:rotate-180" />
								<CaretRightIcon className="-ms-3 rtl:rotate-180" />
							</PagerButton>
						</div>
					</div>
				</div>
				{pickedFile ? (
					<div className="hidden w-80 shrink-0 border-s xl:block">
						<FileDetailsPanel
							file={pickedFile}
							onClose={() => setPickedFileId(null)}
						/>
					</div>
				) : null}
			</div>
		</div>
	);
}

type FilesTitleProps = {
	/** The folders from the top folder down to the open one. */
	trail: Parameters<typeof FolderBreadcrumb>[0]["trail"];
};

// The h1 and the folder trail in one row, split by a short rule, as in the kit file manager.
function FilesTitle({ trail }: FilesTitleProps) {
	const { t } = useT();
	return (
		<div className="flex min-w-0 items-center gap-4">
			<h1 className="font-(--heading-weight) font-display text-2xl tracking-(--heading-tracking)">
				{t("files.title")}
			</h1>
			<Separator
				orientation="vertical"
				className="data-[orientation=vertical]:h-4"
			/>
			<FolderBreadcrumb trail={trail} />
		</div>
	);
}

type PagerButtonProps = {
	/** The translated name of the step, for screen readers. */
	label: string;
	disabled: boolean;
	onClick: () => void;
	/** The caret icons of the step. */
	children: ReactNode;
};

// One ghost icon button of the pager.
function PagerButton({ label, disabled, onClick, children }: PagerButtonProps) {
	return (
		<Button
			type="button"
			variant="ghost"
			size="icon"
			aria-label={label}
			disabled={disabled}
			onClick={onClick}
		>
			{children}
		</Button>
	);
}

// Fixed keys for the placeholder rows, because they never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

/** Placeholder while the loader runs: the title row, the toolbar, and ten rows. */
export function FilesPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex items-center justify-between gap-3">
				<Skeleton className="h-8 w-64" />
				<Skeleton className="h-9 w-32" />
			</div>
			<div className="grid gap-3 border-t pt-4">
				<Skeleton className="h-9 w-full" />
				{SKELETON_ROWS.map((key) => (
					<Skeleton key={key} className="h-10 w-full" />
				))}
			</div>
		</div>
	);
}

/** Error state when the loader fails. Try again runs the loader again. */
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

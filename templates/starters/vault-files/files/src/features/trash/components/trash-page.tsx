// The Trash page behind login, in the shape of the kit order list: a title row with "Export CSV", tabs by final delete,
// then a RecordTable with a filter field, Category and "Deleted by" filters, a column menu, row checkboxes, and row menus.
// The /app/trash route renders it after its loader. The "Deleted soon" tab counts the same files as the header bell.
import {
	CopyIcon,
	DownloadSimpleIcon,
	FolderSimpleIcon,
} from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	type CsvColumn,
	calendarDaysFromNow,
	copyToClipboard,
	downloadCsv,
	FILE_CATEGORIES,
	FileNameCell,
	formatBytes,
	formatRelativeTime,
	MemberAvatar,
	PURGE_SOON_DAYS,
	type TrashItem,
	toCsv,
} from "~/features/workspace";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import {
	type RecordColumn,
	RecordFilter,
	RecordTable,
} from "~/shared/ui/record-table";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { trashQueryOptions } from "../api/trash.queries";
import { PurgeBadge } from "./purge-badge";

/** The tabs: every file, the files deleted for good within PURGE_SOON_DAYS, and the later ones. */
const TRASH_TABS = ["all", "soon", "later"] as const;
type TrashTab = (typeof TRASH_TABS)[number];

// The page shows 10 rows per page, as the kit order list does.
const PAGE_SIZE = 10;

/** The page holds the tab and the two filters; RecordTable holds the search, the sort, and the selection. */
export function TrashPage() {
	const { t, locale } = useT();
	const { data } = useSuspenseQuery(trashQueryOptions());
	const [tab, setTab] = useState<TrashTab>("all");
	const [category, setCategory] = useState<string | null>(null);
	const [deletedBy, setDeletedBy] = useState<string | null>(null);
	const now = Date.now();
	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 1,
	});

	// The same rule as the bell: the final delete falls within PURGE_SOON_DAYS calendar days.
	const isSoon = (file: TrashItem) =>
		calendarDaysFromNow(file.purgeAt, now) <= PURGE_SOON_DAYS;
	const inTab = (file: TrashItem, option: TrashTab) =>
		option === "all" || (option === "soon") === isSoon(file);
	const rows = data.files.filter(
		(file) =>
			inTab(file, tab) &&
			(category === null || file.category === category) &&
			(deletedBy === null || file.deletedByName === deletedBy),
	);
	const people = [
		...new Set(data.files.map((file) => file.deletedByName)),
	].sort();

	const columns: RecordColumn<TrashItem>[] = [
		{
			id: "file",
			header: t("files.columns.name"),
			sortValue: (row) => row.name,
			cell: (row) => (
				<FileNameCell
					fileId={row.id}
					name={row.name}
					kind={row.kind}
					path={row.path}
					linked={false}
				/>
			),
		},
		{
			id: "type",
			header: t("files.columns.type"),
			hideable: true,
			cell: (row) => t(`fileKinds.${row.kind}`),
		},
		{
			id: "deletedBy",
			header: t("trash.columns.deleted"),
			sortValue: (row) => Date.parse(row.deletedAt),
			hideable: true,
			cell: (row) => (
				<span className="flex items-center gap-2 whitespace-nowrap">
					<MemberAvatar name={row.deletedByName} />
					<span className="grid">
						<span className="font-medium">{row.deletedByName}</span>
						<span className="text-muted-foreground text-xs">
							{formatRelativeTime(row.deletedAt, now, locale)}
						</span>
					</span>
				</span>
			),
		},
		{
			id: "size",
			header: t("files.columns.size"),
			align: "end",
			sortValue: (row) => row.sizeBytes,
			cell: (row) => formatBytes(row.sizeBytes, locale),
		},
		{
			id: "purge",
			header: t("trash.columns.purge"),
			sortValue: (row) => Date.parse(row.purgeAt),
			cell: (row) => <PurgeBadge purgeAt={row.purgeAt} />,
		},
	];

	const csvColumns: CsvColumn<TrashItem>[] = [
		{ header: t("files.columns.name"), value: (row) => row.name },
		{
			header: t("trash.originalLocation"),
			value: (row) => row.path.join(" / "),
		},
		{ header: t("trash.columns.deleted"), value: (row) => row.deletedByName },
		{ header: t("trash.deletedOn"), value: (row) => row.deletedAt },
		{
			header: t("files.columns.size"),
			value: (row) => formatBytes(row.sizeBytes, locale),
		},
		{ header: t("trash.columns.purge"), value: (row) => row.purgeAt },
	];

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("trash.title")}
				description={t("trash.description")
					.replace("{count}", number.format(data.retentionDays))
					.replace("{trash}", formatBytes(data.trashBytes, locale))
					.replace(
						"{share}",
						percent.format(
							data.usedBytes > 0 ? data.trashBytes / data.usedBytes : 0,
						),
					)}
				actions={
					<Button
						type="button"
						aria-label={t("common.exportCsv")}
						onClick={() => downloadCsv("trash.csv", toCsv(rows, csvColumns))}
					>
						<DownloadSimpleIcon />
						<span className="hidden lg:inline">{t("common.exportCsv")}</span>
					</Button>
				}
			/>
			{/* min-w-0 lets the tab list scroll on a phone instead of widening the page. */}
			<Tabs
				className="min-w-0"
				value={tab}
				onValueChange={(value) =>
					setTab(TRASH_TABS.find((option) => option === value) ?? "all")
				}
			>
				<TabsList className="max-w-full justify-start overflow-x-auto">
					{TRASH_TABS.map((option) => (
						<TabsTrigger key={option} value={option}>
							{t(`trash.tabs.${option}`)}
							<span className="text-muted-foreground tabular-nums">
								{number.format(
									data.files.filter((file) => inTab(file, option)).length,
								)}
							</span>
						</TabsTrigger>
					))}
				</TabsList>
			</Tabs>
			<RecordTable
				rows={rows}
				columns={columns}
				searchText={(row) => `${row.name} ${row.path.join(" ")}`}
				searchPlaceholder={t("trash.searchPlaceholder")}
				toolbar={
					<>
						<RecordFilter
							label={t("files.typeFilter")}
							options={FILE_CATEGORIES.map((option) => ({
								value: option,
								label: t(`fileCategories.${option}`),
							}))}
							value={category}
							onValueChange={setCategory}
						/>
						<RecordFilter
							label={t("trash.columns.deleted")}
							options={people.map((name) => ({ value: name, label: name }))}
							value={deletedBy}
							onValueChange={setDeletedBy}
						/>
					</>
				}
				rowMenu={(row) => (
					<>
						<DropdownMenuItem asChild>
							<Link
								to="/app/files"
								search={{ folder: row.folderId ?? undefined }}
							>
								<FolderSimpleIcon />
								{t("trash.openFolder")}
							</Link>
						</DropdownMenuItem>
						<DropdownMenuItem
							onSelect={() =>
								copyToClipboard(row.name, {
									done: t("table.copied"),
									failed: t("table.copyFailed"),
								})
							}
						>
							<CopyIcon />
							{t("trash.copyName")}
						</DropdownMenuItem>
					</>
				)}
				selectable
				bulkActions={(selected) => (
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-9"
						onClick={() =>
							downloadCsv("trash-selected.csv", toCsv(selected, csvColumns))
						}
					>
						<DownloadSimpleIcon />
						{t("table.exportSelected")}
					</Button>
				)}
				pageSize={PAGE_SIZE}
				noResults={
					data.files.length === 0 ? t("trash.empty") : t("trash.noResults")
				}
			/>
		</div>
	);
}

// Fixed keys of the placeholder rows, because they never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

/** Placeholder while the loader runs: the title row, the tabs, the toolbar, and ten rows. */
export function TrashPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex items-end justify-between gap-3">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-9 w-32" />
			</div>
			<Skeleton className="h-9 w-72 max-w-full" />
			<Skeleton className="h-9 w-full max-w-sm" />
			<div className="grid gap-2 rounded-md border p-2">
				{SKELETON_ROWS.map((key) => (
					<Skeleton key={key} className="h-12 w-full" />
				))}
			</div>
		</div>
	);
}

/** Error state when the loader fails. Try again runs the loader again. */
export function TrashPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("trash.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}

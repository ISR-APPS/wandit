// The Shared page behind login, in the shape of the kit order list: a title row with "Export CSV", state tabs,
// then a RecordTable with a filter field, Audience and Access filters, a column menu, row checkboxes, and row menus.
// The /app/shared route renders it after its loader. The "Ends soon" tab counts the same shares as the header bell.
import {
	DownloadSimpleIcon,
	FileIcon,
	LinkSimpleIcon,
} from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	type CsvColumn,
	copyToClipboard,
	downloadCsv,
	FileNameCell,
	fileUrl,
	formatRelativeTime,
	SHARE_ACCESS,
	SHARE_ACCESS_BADGE,
	SHARE_STATUS_BADGE,
	SHARE_STATUSES,
	ShareAudience,
	type ShareItem,
	toCsv,
} from "~/features/workspace";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import {
	type RecordColumn,
	RecordFilter,
	RecordTable,
} from "~/shared/ui/record-table";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { sharesQueryOptions } from "../api/shares.queries";

/** The tabs: every share, then one tab per state. */
const SHARED_TABS = ["all", ...SHARE_STATUSES] as const;
type SharedTab = (typeof SHARED_TABS)[number];

/** The two audiences of a share. Their labels are `shares.audiences.<mode>`. */
const SHARE_MODES = ["link", "people"] as const;

// The page shows 10 rows per page, as the kit order list does.
const PAGE_SIZE = 10;

/** The page holds the tab and the two filters; RecordTable holds the search, the sort, and the selection. */
export function SharedPage() {
	const { t, locale } = useT();
	const { data: shares } = useSuspenseQuery(sharesQueryOptions());
	const [tab, setTab] = useState<SharedTab>("all");
	const [mode, setMode] = useState<string | null>(null);
	const [access, setAccess] = useState<string | null>(null);
	const now = Date.now();
	const number = new Intl.NumberFormat(locale);
	const dayFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

	const rows = shares.filter(
		(share) =>
			(tab === "all" || share.status === tab) &&
			(mode === null || share.mode === mode) &&
			(access === null || share.access === access),
	);
	const countOf = (option: SharedTab) =>
		option === "all"
			? shares.length
			: shares.filter((share) => share.status === option).length;
	const audienceText = (share: ShareItem) =>
		share.mode === "link"
			? t("shares.anyoneWithLink")
			: share.recipients.map((contact) => contact.name).join(", ");

	const columns: RecordColumn<ShareItem>[] = [
		{
			id: "file",
			header: t("shares.columns.file"),
			sortValue: (row) => row.fileName,
			cell: (row) => (
				<FileNameCell
					fileId={row.fileId}
					name={row.fileName}
					kind={row.fileKind}
					path={row.path}
				/>
			),
		},
		{
			id: "audience",
			header: t("shares.columns.audience"),
			hideable: true,
			cell: (row) => <ShareAudience share={row} />,
		},
		{
			id: "sharedBy",
			header: t("shares.columns.sharedBy"),
			sortValue: (row) => Date.parse(row.createdAt),
			hideable: true,
			cell: (row) => (
				<span className="grid whitespace-nowrap">
					<span className="font-medium">{row.sharedByName}</span>
					<span className="text-muted-foreground text-xs">
						{dayFormat.format(new Date(row.createdAt))}
					</span>
				</span>
			),
		},
		{
			id: "access",
			header: t("shares.columns.access"),
			hideable: true,
			cell: (row) => (
				<Badge variant={SHARE_ACCESS_BADGE[row.access]}>
					{t(`shares.access.${row.access}`)}
				</Badge>
			),
		},
		{
			id: "ends",
			header: t("shares.expires"),
			// A share with no end sorts after every dated share.
			sortValue: (row) =>
				row.expiresAt === null
					? Number.MAX_SAFE_INTEGER
					: Date.parse(row.expiresAt),
			cell: (row) => (
				<span className="whitespace-nowrap text-muted-foreground">
					{row.expiresAt === null
						? t("shares.noExpiry")
						: formatRelativeTime(row.expiresAt, now, locale)}
				</span>
			),
		},
		{
			id: "views",
			header: t("shares.columns.views"),
			align: "end",
			sortValue: (row) => row.views,
			cell: (row) => number.format(row.views),
		},
		{
			id: "status",
			header: t("shares.columns.status"),
			sortValue: (row) => SHARE_STATUSES.indexOf(row.status),
			cell: (row) => (
				<Badge variant={SHARE_STATUS_BADGE[row.status]}>
					{t(`shares.statuses.${row.status}`)}
				</Badge>
			),
		},
	];

	const csvColumns: CsvColumn<ShareItem>[] = [
		{ header: t("shares.columns.file"), value: (row) => row.fileName },
		{ header: t("shares.columns.audience"), value: audienceText },
		{ header: t("shares.columns.sharedBy"), value: (row) => row.sharedByName },
		{
			header: t("shares.columns.access"),
			value: (row) => t(`shares.access.${row.access}`),
		},
		{ header: t("shares.expires"), value: (row) => row.expiresAt ?? "" },
		{ header: t("shares.columns.views"), value: (row) => String(row.views) },
		{
			header: t("shares.columns.status"),
			value: (row) => t(`shares.statuses.${row.status}`),
		},
	];

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("shares.title")}
				description={t("shares.description")}
				actions={
					<Button
						type="button"
						aria-label={t("common.exportCsv")}
						onClick={() => downloadCsv("shares.csv", toCsv(rows, csvColumns))}
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
					setTab(SHARED_TABS.find((option) => option === value) ?? "all")
				}
			>
				<TabsList className="max-w-full justify-start overflow-x-auto">
					{SHARED_TABS.map((option) => (
						<TabsTrigger key={option} value={option}>
							{option === "all"
								? t("shares.all")
								: t(`shares.statuses.${option}`)}
							<span className="text-muted-foreground tabular-nums">
								{number.format(countOf(option))}
							</span>
						</TabsTrigger>
					))}
				</TabsList>
			</Tabs>
			<RecordTable
				rows={rows}
				columns={columns}
				searchText={(row) =>
					`${row.fileName} ${audienceText(row)} ${row.sharedByName}`
				}
				searchPlaceholder={t("shares.searchPlaceholder")}
				toolbar={
					<>
						<RecordFilter
							label={t("shares.audienceFilter")}
							options={SHARE_MODES.map((option) => ({
								value: option,
								label: t(`shares.audiences.${option}`),
							}))}
							value={mode}
							onValueChange={setMode}
						/>
						<RecordFilter
							label={t("shares.columns.access")}
							options={SHARE_ACCESS.map((option) => ({
								value: option,
								label: t(`shares.access.${option}`),
							}))}
							value={access}
							onValueChange={setAccess}
						/>
					</>
				}
				rowMenu={(row) => (
					<>
						<DropdownMenuItem asChild>
							<Link to="/app/files/$fileId" params={{ fileId: row.fileId }}>
								<FileIcon />
								{t("files.open")}
							</Link>
						</DropdownMenuItem>
						<DropdownMenuItem
							onSelect={() =>
								copyToClipboard(fileUrl(row.fileId), {
									done: t("table.copied"),
									failed: t("table.copyFailed"),
								})
							}
						>
							<LinkSimpleIcon />
							{t("files.copyLink")}
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
							downloadCsv("shares-selected.csv", toCsv(selected, csvColumns))
						}
					>
						<DownloadSimpleIcon />
						{t("table.exportSelected")}
					</Button>
				)}
				pageSize={PAGE_SIZE}
				noResults={t("shares.noResults")}
			/>
		</div>
	);
}

// Fixed keys of the placeholder rows, because they never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

/** Placeholder while the loader runs: the title row, the tabs, the toolbar, and ten rows. */
export function SharedPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex items-end justify-between gap-3">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-9 w-32" />
			</div>
			<Skeleton className="h-9 w-80 max-w-full" />
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
export function SharedPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("shares.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}

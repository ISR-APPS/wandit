// The Recent page behind login, in the shape of the kit order list: a title row with "Export CSV", action tabs,
// then a RecordTable with a filter field, Person and Category filters, a column menu, row checkboxes, and row menus.
// The /app/recent route renders it after its loader. The rows are the feed of the last FEED_DAYS days.
import {
	DownloadSimpleIcon,
	FileIcon,
	LinkSimpleIcon,
	TrashIcon,
} from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	ACTIVITY_ACTIONS,
	ACTIVITY_BADGE,
	type ActivityItem,
	CATEGORY_OF_KIND,
	type CsvColumn,
	copyToClipboard,
	downloadCsv,
	FILE_CATEGORIES,
	FileNameCell,
	fileUrl,
	formatRelativeTime,
	MemberAvatar,
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
import { activityQueryOptions, FEED_DAYS } from "../api/activity.queries";

/** The tabs: every action, then one tab per action. */
const RECENT_TABS = ["all", ...ACTIVITY_ACTIONS] as const;
type RecentTab = (typeof RECENT_TABS)[number];

// The page shows 10 rows per page, as the kit order list does.
const PAGE_SIZE = 10;

/** The page holds the tab and the two filters; RecordTable holds the search, the sort, and the selection. */
export function RecentPage() {
	const { t, locale } = useT();
	const { data: items } = useSuspenseQuery(activityQueryOptions());
	const [tab, setTab] = useState<RecentTab>("all");
	const [person, setPerson] = useState<string | null>(null);
	const [category, setCategory] = useState<string | null>(null);
	const now = Date.now();
	const number = new Intl.NumberFormat(locale);
	const dateTime = new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeStyle: "short",
	});

	const people = [...new Set(items.map((item) => item.actorName))].sort();
	const rows = items.filter(
		(item) =>
			(tab === "all" || item.action === tab) &&
			(person === null || item.actorName === person) &&
			(category === null || CATEGORY_OF_KIND[item.fileKind] === category),
	);
	const countOf = (option: RecentTab) =>
		option === "all"
			? items.length
			: items.filter((item) => item.action === option).length;

	const columns: RecordColumn<ActivityItem>[] = [
		{
			id: "file",
			header: t("files.columns.name"),
			sortValue: (row) => row.fileName,
			cell: (row) => (
				<FileNameCell
					fileId={row.fileId}
					name={row.fileName}
					kind={row.fileKind}
					path={row.path}
					linked={!row.isInTrash}
				/>
			),
		},
		{
			id: "action",
			header: t("recent.columns.action"),
			sortValue: (row) => row.action,
			cell: (row) => (
				<Badge variant={ACTIVITY_BADGE[row.action]}>
					{t(`activity.titles.${row.action}`)}
				</Badge>
			),
		},
		{
			id: "person",
			header: t("recent.columns.person"),
			sortValue: (row) => row.actorName,
			hideable: true,
			cell: (row) => (
				<span className="flex items-center gap-2 whitespace-nowrap">
					<MemberAvatar name={row.actorName} />
					{row.actorName}
				</span>
			),
		},
		{
			id: "detail",
			header: t("recent.columns.detail"),
			hideable: true,
			cell: (row) => (
				<span
					className="block max-w-56 truncate text-muted-foreground"
					dir="auto"
				>
					{detailOf(row, t)}
				</span>
			),
		},
		{
			id: "when",
			header: t("recent.columns.when"),
			sortValue: (row) => Date.parse(row.at),
			cell: (row) => (
				<span className="grid whitespace-nowrap">
					<span className="tabular-nums">
						{dateTime.format(new Date(row.at))}
					</span>
					<span className="text-muted-foreground text-xs">
						{formatRelativeTime(row.at, now, locale)}
					</span>
				</span>
			),
		},
	];

	const csvColumns: CsvColumn<ActivityItem>[] = [
		{ header: t("files.columns.name"), value: (row) => row.fileName },
		{ header: t("files.location"), value: (row) => row.path.join(" / ") },
		{
			header: t("recent.columns.action"),
			value: (row) => t(`activity.titles.${row.action}`),
		},
		{ header: t("recent.columns.person"), value: (row) => row.actorName },
		{ header: t("recent.columns.detail"), value: (row) => detailOf(row, t) },
		{ header: t("recent.columns.when"), value: (row) => row.at },
	];

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("recent.title")}
				description={t("recent.description").replace(
					"{count}",
					number.format(FEED_DAYS),
				)}
				actions={
					<Button
						type="button"
						aria-label={t("common.exportCsv")}
						onClick={() => downloadCsv("recent.csv", toCsv(rows, csvColumns))}
					>
						<DownloadSimpleIcon />
						<span className="hidden lg:inline">{t("common.exportCsv")}</span>
					</Button>
				}
			/>
			{/* On a phone the tab list wraps to a second row, so every tab and its count stays in view.
			    A wrapped row cannot use the percent height of a trigger, so the phone trigger gets a fixed height. */}
			<Tabs
				className="min-w-0"
				value={tab}
				onValueChange={(value) =>
					setTab(RECENT_TABS.find((option) => option === value) ?? "all")
				}
			>
				<TabsList className="max-w-full justify-start max-sm:flex-wrap max-sm:group-data-[orientation=horizontal]/tabs:h-auto">
					{RECENT_TABS.map((option) => (
						<TabsTrigger key={option} value={option} className="max-sm:h-8">
							{option === "all"
								? t("recent.all")
								: t(`activity.actions.${option}`)}
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
				searchText={(row) => `${row.fileName} ${row.path.join(" ")}`}
				searchPlaceholder={t("recent.searchPlaceholder")}
				toolbar={
					<>
						<RecordFilter
							label={t("recent.columns.person")}
							options={people.map((name) => ({ value: name, label: name }))}
							value={person}
							onValueChange={setPerson}
						/>
						<RecordFilter
							label={t("files.typeFilter")}
							options={FILE_CATEGORIES.map((option) => ({
								value: option,
								label: t(`fileCategories.${option}`),
							}))}
							value={category}
							onValueChange={setCategory}
						/>
					</>
				}
				rowMenu={(row) => <ActivityRowMenu item={row} />}
				selectable
				bulkActions={(selected) => (
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-9"
						onClick={() =>
							downloadCsv("recent-selected.csv", toCsv(selected, csvColumns))
						}
					>
						<DownloadSimpleIcon />
						{t("table.exportSelected")}
					</Button>
				)}
				pageSize={PAGE_SIZE}
				noResults={t("recent.noResults")}
			/>
		</div>
	);
}

type ActivityRowMenuProps = {
	item: ActivityItem;
};

// The row menu: a live file opens its page or copies its link; a trashed file opens the Trash page.
function ActivityRowMenu({ item }: ActivityRowMenuProps) {
	const { t } = useT();
	if (item.isInTrash) {
		return (
			<DropdownMenuItem asChild>
				<Link to="/app/trash">
					<TrashIcon />
					{t("recent.openTrash")}
				</Link>
			</DropdownMenuItem>
		);
	}
	return (
		<>
			<DropdownMenuItem asChild>
				<Link to="/app/files/$fileId" params={{ fileId: item.fileId }}>
					<FileIcon />
					{t("files.open")}
				</Link>
			</DropdownMenuItem>
			<DropdownMenuItem
				onSelect={() =>
					copyToClipboard(fileUrl(item.fileId), {
						done: t("table.copied"),
						failed: t("table.copyFailed"),
					})
				}
			>
				<LinkSimpleIcon />
				{t("files.copyLink")}
			</DropdownMenuItem>
		</>
	);
}

// The detail cell: the version of an upload, or the people of a share. A delete has none.
function detailOf(item: ActivityItem, t: ReturnType<typeof useT>["t"]): string {
	if (item.versionNumber !== null) {
		return t("recent.versionDetail").replace(
			"{version}",
			String(item.versionNumber),
		);
	}
	if (item.action === "shared") {
		return item.recipientNames.length > 0
			? item.recipientNames.join(", ")
			: t("shares.anyoneWithLink");
	}
	return "";
}

// Fixed keys of the placeholder rows, because they never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

/** Placeholder while the loader runs: the title row, the tabs, the toolbar, and ten rows. */
export function RecentPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex items-end justify-between gap-3">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-9 w-32" />
			</div>
			<Skeleton className="h-9 w-96 max-w-full" />
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
export function RecentPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("recent.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}

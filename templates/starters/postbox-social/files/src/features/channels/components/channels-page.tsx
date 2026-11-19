// The channel list, on the layout of the kit "users" page: the title and the export,
// then the table with a filter field, Status and Format filters, a column menu, checkboxes, and pages.
// The /app/channels route renders it after its loader. The two filters are state of the page.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	ChannelMark,
	type CsvColumn,
	copyToClipboard,
	countForm,
	downloadCsv,
	fillMessage,
	LoadError,
	POST_FORMATS,
	rateFormat,
	toCsv,
} from "~/features/social";
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
import {
	type ChannelRow,
	type ChannelStatus,
	channelsQueryOptions,
} from "../api/channels.queries";

// The kit list shows ten rows per page.
const PAGE_SIZE = 10;

// Every status, in the order of the filter.
const CHANNEL_STATUSES: readonly ChannelStatus[] = ["active", "reconnect"];

/** The connected accounts of the brand. Every control filters the rows in the browser. */
export function ChannelsPage() {
	const { t, locale } = useT();
	const { data: channels } = useSuspenseQuery(channelsQueryOptions());
	const [status, setStatus] = useState<string | null>(null);
	const [format, setFormat] = useState<string | null>(null);
	const number = new Intl.NumberFormat(locale);
	const rate = rateFormat(locale);

	const rows = channels.filter(
		(channel) =>
			(status === null || channel.status === status) &&
			(format === null ||
				channel.profile.formats.some((value) => value === format)),
	);

	const csvColumns: CsvColumn<ChannelRow>[] = [
		{
			header: t("channels.name"),
			value: (row) => t(`channels.names.${row.id}`),
		},
		{ header: t("channels.handle"), value: (row) => row.profile.handle },
		{
			header: t("metrics.followers"),
			value: (row) => String(row.figures.followers),
		},
		{
			header: t("metrics.engagementRate"),
			value: (row) => rate.format(row.figures.engagementRate),
		},
		{
			header: t("channels.posts30"),
			value: (row) => String(row.figures.posts),
		},
		{
			header: t("channels.status"),
			value: (row) => t(`channels.statuses.${row.status}`),
		},
	];

	const columns: RecordColumn<ChannelRow>[] = [
		{
			id: "name",
			header: t("channels.name"),
			cell: (row) => (
				<div className="flex items-center gap-4">
					<ChannelMark channelId={row.id} className="rounded-full" />
					<Link
						to="/app/channels/$channelId"
						params={{ channelId: row.id }}
						className="font-medium hover:underline"
					>
						{t(`channels.names.${row.id}`)}
					</Link>
				</div>
			),
			sortValue: (row) => t(`channels.names.${row.id}`),
		},
		{
			id: "handle",
			header: t("channels.handle"),
			cell: (row) => row.profile.handle,
			sortValue: (row) => row.profile.handle,
			hideable: true,
		},
		{
			id: "followers",
			header: t("metrics.followers"),
			cell: (row) => number.format(row.figures.followers),
			sortValue: (row) => row.figures.followers,
			hideable: true,
		},
		{
			id: "rate",
			// The short headers keep the row menu in view at 1280 px. The page description names the 30 days.
			header: t("metrics.engagementRateShort"),
			cell: (row) => rate.format(row.figures.engagementRate),
			sortValue: (row) => row.figures.engagementRate,
			hideable: true,
		},
		{
			id: "posts",
			header: t("channels.postsShort"),
			cell: (row) => number.format(row.figures.posts),
			sortValue: (row) => row.figures.posts,
			hideable: true,
		},
		{
			id: "goal",
			header: t("channels.weeklyGoalLabel"),
			cell: (row) =>
				fillMessage(
					t(
						`channels.weeklyGoalValue.${countForm(locale, row.profile.postsPerWeek)}`,
					),
					{
						goal: number.format(row.profile.postsPerWeek),
					},
				),
			sortValue: (row) => row.profile.postsPerWeek,
			hideable: true,
		},
		{
			id: "status",
			header: t("channels.status"),
			cell: (row) => (
				<Badge variant={row.status === "active" ? "success" : "warning"}>
					{t(`channels.statuses.${row.status}`)}
				</Badge>
			),
			sortValue: (row) => CHANNEL_STATUSES.indexOf(row.status),
			hideable: true,
		},
	];

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("channels.title")}
				description={fillMessage(t("channels.description"), {
					count: number.format(channels.length),
				})}
				actions={
					<Button
						type="button"
						onClick={() =>
							downloadCsv("postbox-channels.csv", toCsv(rows, csvColumns))
						}
					>
						<DownloadSimpleIcon />
						{t("channels.exportCsv")}
					</Button>
				}
			/>
			<RecordTable
				rows={rows}
				columns={columns}
				searchText={(row) =>
					`${t(`channels.names.${row.id}`)} ${row.profile.handle}`
				}
				searchPlaceholder={t("channels.searchPlaceholder")}
				toolbar={
					<>
						<RecordFilter
							label={t("channels.status")}
							options={CHANNEL_STATUSES.map((value) => ({
								value,
								label: t(`channels.statuses.${value}`),
							}))}
							value={status}
							onValueChange={setStatus}
						/>
						<RecordFilter
							label={t("posts.format")}
							options={POST_FORMATS.map((value) => ({
								value,
								label: t(`formats.${value}`),
							}))}
							value={format}
							onValueChange={setFormat}
						/>
					</>
				}
				rowMenu={(row) => (
					<>
						<DropdownMenuItem asChild>
							<Link
								to="/app/channels/$channelId"
								params={{ channelId: row.id }}
							>
								{t("channels.open")}
							</Link>
						</DropdownMenuItem>
						<DropdownMenuItem
							onSelect={() =>
								copyToClipboard(row.profile.handle, {
									done: t("table.copied"),
									failed: t("table.copyFailed"),
								})
							}
						>
							{t("channels.copyHandle")}
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
							downloadCsv(
								"postbox-channels-selected.csv",
								toCsv(selected, csvColumns),
							)
						}
					>
						<DownloadSimpleIcon />
						{t("table.exportSelected")}
					</Button>
				)}
				pageSize={PAGE_SIZE}
				noResults={t("channels.noResults")}
			/>
		</div>
	);
}

/** Loading state of the channel list: the header, the toolbar, and the table. */
export function ChannelsPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex items-end justify-between gap-3">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-9 w-32" />
			</div>
			<Skeleton className="h-9 w-full" />
			<Skeleton className="h-80 w-full" />
		</div>
	);
}

/** Error state of the channel pages when a loader fails. Try again runs the loader again. */
export function ChannelsPageError() {
	const { t } = useT();
	return <LoadError message={t("channels.loadError")} />;
}

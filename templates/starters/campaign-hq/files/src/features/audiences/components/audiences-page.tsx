// The audience page behind login: the page header with the CSV export, then the segment table and a side panel per audience.
// The /app/audiences route renders it after its loader. The route also uses the skeleton and the error below.
// It follows the kit "users" page: a table with no card, three filter buttons, row checkboxes, and a row menu.
// The type filter and the open panel live in the URL (`?type=`, `?audience=`), so the campaign page can link to one audience.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	AUDIENCE_TYPES,
	type CsvColumn,
	copyToClipboard,
	DeltaBadge,
	downloadCsv,
	fillMessage,
	initialsOf,
	toCsv,
} from "~/features/marketing";
import { type TranslationKey, useT } from "~/shared/i18n";
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import {
	type RecordColumn,
	RecordFilter,
	RecordTable,
} from "~/shared/ui/record-table";
import { Skeleton } from "~/shared/ui/skeleton";
import { type Audience, audiencesQueryOptions } from "../api/audiences.queries";
import { AudienceSheet } from "./audience-sheet";

const routeApi = getRouteApi("/app/audiences");

/** The usage filter: segments in at least one live campaign, or segments that no campaign targets. */
const USAGES = ["live", "unused"] as const;
type Usage = (typeof USAGES)[number];

// Rows per page of a list page, as in the kit users table.
const PAGE_SIZE = 20;

/** The filters cut the rows; then RecordTable searches, sorts, selects, and pages them. */
export function AudiencesPage() {
	const { t, locale } = useT();
	const { data: audiences } = useSuspenseQuery(audiencesQueryOptions());
	const { type, audience: audienceId } = routeApi.useSearch();
	const navigate = routeApi.useNavigate();
	const [client, setClient] = useState<string | null>(null);
	const [usage, setUsage] = useState<Usage | null>(null);
	// The id of the audience that the sheet showed last. The sheet keeps it while it slides out.
	const [closingId, setClosingId] = useState<string | null>(null);

	const number = new Intl.NumberFormat(locale);
	const compact = new Intl.NumberFormat(locale, {
		notation: "compact",
		maximumFractionDigits: 1,
	});
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		minimumFractionDigits: 1,
		maximumFractionDigits: 1,
	});
	const openAudience = audiences.find((row) => row.id === audienceId) ?? null;
	const sheetAudience =
		openAudience ?? audiences.find((row) => row.id === closingId) ?? null;

	function openPanel(id: string) {
		navigate({
			search: (previous) => ({ ...previous, audience: id }),
			replace: true,
		});
	}

	const liveCount = (row: Audience) =>
		row.campaigns.filter((campaign) => campaign.status === "live").length;
	const clients = [...new Set(audiences.map((row) => row.client))]
		.sort((first, second) => first.localeCompare(second, locale))
		.map((name) => ({ value: name, label: name }));
	const rows = audiences.filter(
		(row) =>
			(type === undefined || row.type === type) &&
			(client === null || row.client === client) &&
			(usage === null ||
				(usage === "live" ? liveCount(row) > 0 : row.campaigns.length === 0)),
	);

	const csvColumns: CsvColumn<Audience>[] = [
		{ header: t("audiences.code"), value: (row) => row.id },
		{ header: t("audiences.audience"), value: (row) => row.name },
		{ header: t("audiences.client"), value: (row) => row.client },
		{
			header: t("audiences.type"),
			value: (row) => t(`audienceTypes.${row.type}`),
		},
		{ header: t("audiences.size"), value: (row) => String(row.size) },
		{
			header: t("audiences.engagement"),
			value: (row) => row.engagementRate.toFixed(4),
		},
		{
			header: t("audiences.growth"),
			value: (row) => (row.growth === null ? "" : row.growth.toFixed(4)),
		},
		{
			header: t("audiences.campaigns"),
			value: (row) => String(row.campaigns.length),
		},
	];

	const columns: RecordColumn<Audience>[] = [
		{
			id: "audience",
			header: t("audiences.audience"),
			sortValue: (row) => row.name,
			cell: (row) => (
				// The avatar, the name, and the client are one button. A finger hits it more easily than the name alone.
				<button
					type="button"
					className="group flex items-center gap-3 rounded-control text-start outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
					aria-label={fillMessage(t("audiences.open"), { name: row.name })}
					onClick={() => openPanel(row.id)}
				>
					<Avatar className="size-9">
						<AvatarFallback className="text-xs">
							{initialsOf(row.name)}
						</AvatarFallback>
					</Avatar>
					<span className="grid justify-items-start">
						<span className="font-medium group-hover:underline" dir="auto">
							{row.name}
						</span>
						<span className="text-muted-foreground text-xs" dir="auto">
							{row.client}
						</span>
					</span>
				</button>
			),
		},
		{
			id: "type",
			header: t("audiences.type"),
			hideable: true,
			sortValue: (row) => AUDIENCE_TYPES.indexOf(row.type),
			cell: (row) => t(`audienceTypes.${row.type}`),
		},
		{
			id: "size",
			header: t("audiences.size"),
			hideable: true,
			align: "end",
			sortValue: (row) => row.size,
			cell: (row) => compact.format(row.size),
		},
		{
			id: "engagement",
			header: t("audiences.engagement"),
			hideable: true,
			align: "end",
			sortValue: (row) => row.engagementRate,
			cell: (row) => percent.format(row.engagementRate),
		},
		{
			id: "campaigns",
			header: t("audiences.campaigns"),
			hideable: true,
			sortValue: (row) => liveCount(row),
			cell: (row) =>
				row.campaigns.length === 0 ? (
					<Badge variant="outline">{t("audiences.noCampaign")}</Badge>
				) : (
					<Badge variant={liveCount(row) > 0 ? "success" : "secondary"}>
						{fillMessage(t("audiences.liveCount"), {
							live: number.format(liveCount(row)),
							total: number.format(row.campaigns.length),
						})}
					</Badge>
				),
		},
		{
			id: "growth",
			header: t("audiences.growth"),
			hideable: true,
			align: "end",
			// A segment with no size 30 days ago sorts as the slowest.
			sortValue: (row) => row.growth ?? Number.NEGATIVE_INFINITY,
			cell: (row) => (
				<DeltaBadge
					change={row.growth}
					goodWhen="up"
					srLabel={t("audiences.growthLabel")}
				/>
			),
		},
	];

	const usageLabel: Record<Usage, TranslationKey> = {
		live: "audiences.usageLive",
		unused: "audiences.usageUnused",
	};

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("audiences.title")}
				description={fillMessage(t("audiences.description"), {
					count: number.format(audiences.length),
				})}
				actions={
					<Button
						type="button"
						onClick={() =>
							downloadCsv("audiences.csv", toCsv(rows, csvColumns))
						}
					>
						<DownloadSimpleIcon />
						{t("common.exportCsv")}
					</Button>
				}
			/>
			<RecordTable
				rows={rows}
				columns={columns}
				searchText={(row) => `${row.name} ${row.client} ${row.definition}`}
				searchPlaceholder={t("audiences.filter")}
				toolbar={
					<>
						<RecordFilter
							label={t("audiences.type")}
							options={AUDIENCE_TYPES.map((value) => ({
								value,
								label: t(`audienceTypes.${value}`),
							}))}
							value={type ?? null}
							onValueChange={(value) =>
								navigate({
									search: (previous) => ({
										...previous,
										type: AUDIENCE_TYPES.find((option) => option === value),
									}),
									replace: true,
								})
							}
						/>
						<RecordFilter
							label={t("audiences.client")}
							options={clients}
							value={client}
							onValueChange={setClient}
						/>
						<RecordFilter
							label={t("audiences.campaigns")}
							options={USAGES.map((value) => ({
								value,
								label: t(usageLabel[value]),
							}))}
							value={usage}
							onValueChange={(value) =>
								setUsage(USAGES.find((option) => option === value) ?? null)
							}
						/>
					</>
				}
				pageSize={PAGE_SIZE}
				noResults={t("audiences.noResults")}
				selectable
				bulkActions={(selectedRows) => (
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-9"
						onClick={() =>
							downloadCsv(
								"audiences-selected.csv",
								toCsv(selectedRows, csvColumns),
							)
						}
					>
						<DownloadSimpleIcon />
						{t("table.exportSelected")}
					</Button>
				)}
				rowMenu={(row) => (
					<>
						<DropdownMenuItem onSelect={() => openPanel(row.id)}>
							{t("audiences.openPanel")}
						</DropdownMenuItem>
						<DropdownMenuItem
							onSelect={() =>
								copyToClipboard(row.id, {
									done: t("table.copied"),
									failed: t("table.copyFailed"),
								})
							}
						>
							{t("audiences.copyId")}
						</DropdownMenuItem>
					</>
				)}
			/>
			<AudienceSheet
				audience={sheetAudience}
				open={openAudience !== null}
				onOpenChange={(open) => {
					if (!open) {
						setClosingId(openAudience?.id ?? null);
						navigate({
							search: (previous) => ({ ...previous, audience: undefined }),
							replace: true,
						});
					}
				}}
			/>
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8"];

/** Placeholder while the audience loader runs. The route sets it as pendingComponent. */
export function AudiencesPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex items-end justify-between gap-4">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-40" />
					<Skeleton className="h-4 w-72" />
				</div>
				<Skeleton className="h-9 w-32" />
			</div>
			<Skeleton className="h-9 w-full sm:max-w-sm" />
			{SKELETON_ROWS.map((key) => (
				<Skeleton key={key} className="h-12 w-full" />
			))}
		</div>
	);
}

/** Error state of the audience page when the loader fails. Try again runs the loader again. */
export function AudiencesPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("audiences.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}

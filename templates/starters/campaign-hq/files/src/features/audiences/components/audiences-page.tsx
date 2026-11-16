// The audience page behind login: three figures, the type tabs, the searchable table, and a side panel per audience.
// The /app/audiences route renders it after its loader. The route also uses the skeleton and the error below.
// The type tab and the open panel live in the URL (`?type=`, `?audience=`), so the campaign page can link to one audience.
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { AUDIENCE_TYPES, ChangeLine, fillMessage } from "~/features/marketing";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { type Audience, audiencesQueryOptions } from "../api/audiences.queries";
import { AudienceFigures } from "./audience-figures";
import { AudienceSheet } from "./audience-sheet";

const routeApi = getRouteApi("/app/audiences");

/** The list page. The type tab cuts the rows; then DataTable searches, sorts, and pages them. */
export function AudiencesPage() {
	const { t, locale } = useT();
	const { data: audiences } = useSuspenseQuery(audiencesQueryOptions());
	const { type, audience: audienceId } = routeApi.useSearch();
	const navigate = routeApi.useNavigate();
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

	// A tab shows only for a type that has rows.
	const tabs = AUDIENCE_TYPES.map((value) => ({
		value,
		count: audiences.filter((row) => row.type === value).length,
	})).filter((tab) => tab.count > 0);
	const activeType =
		type && tabs.some((tab) => tab.value === type) ? type : undefined;
	const rows = activeType
		? audiences.filter((row) => row.type === activeType)
		: audiences;

	// A phone shows only the first column (see the table wrapper). Its cell then adds the size and the growth.
	// The type tabs give the type there.
	const columns: DataTableColumn<Audience>[] = [
		{
			id: "audience",
			header: t("audiences.audience"),
			sortValue: (row) => row.name,
			cell: (row) => (
				<div className="grid min-w-40 justify-items-start gap-0.5">
					<button
						type="button"
						// The name opens the segment sheet. On a phone, the larger hit area gives a 44 px touch target.
						className="relative rounded-sm text-start font-medium outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 max-sm:before:absolute max-sm:before:-inset-3"
						dir="auto"
						aria-label={fillMessage(t("audiences.open"), { name: row.name })}
						onClick={() =>
							navigate({
								search: (previous) => ({ ...previous, audience: row.id }),
								replace: true,
							})
						}
					>
						{row.name}
					</button>
					<span className="text-muted-foreground text-xs" dir="auto">
						{row.client}
					</span>
					<span className="flex items-center gap-2 whitespace-nowrap text-xs tabular-nums md:hidden">
						{compact.format(row.size)}
						<ChangeLine
							change={row.growth}
							goodWhen="up"
							srLabel={t("audiences.growthLabel")}
							className="[&_svg]:size-3.5"
						/>
					</span>
				</div>
			),
		},
		{
			id: "type",
			header: t("audiences.type"),
			sortValue: (row) => AUDIENCE_TYPES.indexOf(row.type),
			cell: (row) => (
				<Badge variant="outline">{t(`audienceTypes.${row.type}`)}</Badge>
			),
		},
		// The 30-day change sits under the size, so the six facts of a segment fit a 1024 px screen.
		{
			id: "size",
			header: t("audiences.size"),
			align: "end",
			sortValue: (row) => row.size,
			cell: (row) => (
				<div className="grid justify-items-end whitespace-nowrap">
					<span>{compact.format(row.size)}</span>
					<ChangeLine
						change={row.growth}
						goodWhen="up"
						srLabel={t("audiences.growthLabel")}
						className="text-xs [&_svg]:size-3.5"
					/>
				</div>
			),
		},
		{
			id: "engagement",
			header: t("audiences.engagement"),
			align: "end",
			sortValue: (row) => row.engagementRate,
			cell: (row) => percent.format(row.engagementRate),
		},
		{
			id: "campaigns",
			header: t("audiences.campaigns"),
			align: "end",
			sortValue: (row) => row.campaigns.length,
			cell: (row) => {
				const live = row.campaigns.filter(
					(campaign) => campaign.status === "live",
				).length;
				return row.campaigns.length === 0 ? (
					<span className="text-muted-foreground">
						{t("audiences.noCampaign")}
					</span>
				) : (
					<span className="whitespace-nowrap tabular-nums">
						{fillMessage(t("audiences.liveCount"), {
							live: number.format(live),
							total: number.format(row.campaigns.length),
						})}
					</span>
				);
			},
		},
	];

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("audiences.title")}
				description={t("audiences.description")}
			/>
			<AudienceFigures audiences={audiences} />
			<Card>
				{/* A phone hides every column after the first, so the table needs no sideways scroll. */}
				<CardContent className="max-md:[&_:is(th,td):nth-child(n+2)]:hidden">
					<DataTable
						rows={rows}
						columns={columns}
						searchText={(row) => `${row.name} ${row.client}`}
						noResults={t("audiences.noResults")}
						toolbar={
							<Tabs
								value={activeType ?? "all"}
								onValueChange={(value) =>
									navigate({
										search: (previous) => ({
											...previous,
											type: AUDIENCE_TYPES.find((option) => option === value),
										}),
										replace: true,
									})
								}
								className="max-w-full overflow-x-auto max-md:-mx-1 max-md:px-1"
							>
								{/* On a phone the tabs stay on one line and scroll sideways. Each tab is 44 px tall. */}
								<TabsList className="max-md:w-max max-md:group-data-[orientation=horizontal]/tabs:h-auto">
									<TabsTrigger value="all" className="max-md:min-h-11">
										{t("audiences.all")}
										{/* opacity, not a muted color: the count takes the color of the active chip too. */}
										<span className="tabular-nums opacity-70">
											{number.format(audiences.length)}
										</span>
									</TabsTrigger>
									{tabs.map((tab) => (
										<TabsTrigger
											key={tab.value}
											value={tab.value}
											className="max-md:min-h-11"
										>
											{t(`audienceTypes.${tab.value}`)}
											<span className="tabular-nums opacity-70">
												{number.format(tab.count)}
											</span>
										</TabsTrigger>
									))}
								</TabsList>
							</Tabs>
						}
					/>
				</CardContent>
			</Card>
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
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-4 w-72" />
			</div>
			<Skeleton className="@xl/main:h-28 h-80 w-full" />
			<Card>
				<CardContent className="grid gap-3">
					<Skeleton className="h-9 w-full sm:max-w-xs" />
					{SKELETON_ROWS.map((key) => (
						<Skeleton key={key} className="h-12 w-full" />
					))}
				</CardContent>
			</Card>
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

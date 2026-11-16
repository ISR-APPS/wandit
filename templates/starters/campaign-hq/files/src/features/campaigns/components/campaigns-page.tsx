// The campaign list behind login: the page header, the status tabs, the channel filter, and the searchable table.
// The /app/campaigns route renders it after its loader. The route also uses the skeleton and the error below.
// The status and the channel live in the URL (`?status=`, `?channel=`), so the home can link to one tab.
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useRouter } from "@tanstack/react-router";
import { PageHeader } from "~/features/app-shell";
import {
	CAMPAIGN_STATUSES,
	CampaignStatusBadge,
	CHANNELS,
	ChannelMark,
	costPerConversion,
	fillMessage,
	formatMultiple,
	moneyFormat,
	parseChannel,
	returnOnSpend,
} from "~/features/marketing";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { type Campaign, campaignsQueryOptions } from "../api/campaigns.queries";
import { PACING_BADGE } from "../lib/pacing";
import { BudgetCell } from "./budget-cell";
import { ChannelMarks } from "./channel-marks";
import { FlightCell } from "./flight-cell";

const routeApi = getRouteApi("/app/campaigns/");

// The Select needs a value for "no filter". No channel code is "all".
const ALL_CHANNELS = "all";

/** The list page. The channel filter and the status tab filter the rows; then DataTable searches, sorts, and pages them. */
export function CampaignsPage() {
	const { t, locale } = useT();
	const { data: campaigns } = useSuspenseQuery(campaignsQueryOptions());
	const { status, channel } = routeApi.useSearch();
	const navigate = routeApi.useNavigate();

	const number = new Intl.NumberFormat(locale);
	const money = moneyFormat(locale, "cents");
	const compactMoney = moneyFormat(locale, "compact");
	const percent = new Intl.NumberFormat(locale, { style: "percent" });
	const now = Date.now();
	// The tab counts follow the channel filter, so a count equals the rows of its tab.
	const inChannel = channel
		? campaigns.filter((row) => row.channels.includes(channel))
		: campaigns;
	const tabs = CAMPAIGN_STATUSES.map((value) => ({
		value,
		count: inChannel.filter((row) => row.status === value).length,
	})).filter((tab) => tab.count > 0);
	// A status with no row has no tab, so the list shows all rows then.
	const activeStatus =
		status && tabs.some((tab) => tab.value === status) ? status : undefined;
	const rows = activeStatus
		? inChannel.filter((row) => row.status === activeStatus)
		: inChannel;

	// Five columns fit a 1024 px screen with the sidebar open. So the channel marks sit in the campaign cell,
	// and one Results column holds the conversions, the cost per conversion, and the return.
	// The campaign code is not shown here: the search matches it, and the campaign page shows it.
	// A phone shows only the first two columns (see the table wrapper). The campaign cell then adds the budget and the results.
	const columns: DataTableColumn<Campaign>[] = [
		{
			id: "campaign",
			header: t("campaigns.campaign"),
			sortValue: (row) => row.name,
			// justify-items-start: each line is as wide as its text. Then dir="auto" text sits at the start side in Arabic too.
			cell: (row) => (
				<div className="grid min-w-40 justify-items-start gap-0.5">
					<Link
						to="/app/campaigns/$campaignId"
						params={{ campaignId: row.id }}
						className="font-medium hover:underline"
						dir="auto"
					>
						{row.name}
					</Link>
					<span className="flex items-center gap-2 whitespace-nowrap text-muted-foreground text-xs">
						<span dir="auto">{row.client}</span>
						<ChannelMarks channels={row.channels} />
					</span>
					<span className="whitespace-nowrap text-muted-foreground text-xs tabular-nums md:hidden">
						{fillMessage(t("campaigns.budgetShare"), {
							percent: percent.format(row.totals.spend / row.budget),
							budget: compactMoney.format(row.budget),
						})}
						{/* A campaign that did not start has no result, so the line stops at the budget. */}
						{row.elapsedDays === 0
							? null
							: ` · ${fillMessage(t("campaigns.conversionsShort"), {
									count: number.format(row.totals.conversions),
								})}`}
					</span>
				</div>
			),
		},
		{
			id: "status",
			header: t("campaigns.status"),
			sortValue: (row) => CAMPAIGN_STATUSES.indexOf(row.status),
			cell: (row) => (
				<div className="grid justify-items-start gap-1">
					<CampaignStatusBadge status={row.status} />
					{row.pacing ? (
						<span
							className={cn(
								"whitespace-nowrap text-xs",
								PACING_BADGE[row.pacing.state] === "warning"
									? "text-warning"
									: "text-muted-foreground",
							)}
						>
							{t(`pacing.${row.pacing.state}`)}
						</span>
					) : null}
				</div>
			),
		},
		{
			id: "flight",
			header: t("campaigns.flight"),
			sortValue: (row) => Date.parse(row.startAt),
			cell: (row) => <FlightCell campaign={row} now={now} />,
		},
		{
			id: "budget",
			header: t("campaigns.budget"),
			sortValue: (row) => row.totals.spend / row.budget,
			cell: (row) => <BudgetCell campaign={row} />,
		},
		{
			id: "results",
			header: t("campaigns.resultsColumn"),
			align: "end",
			sortValue: (row) => row.totals.conversions,
			cell: (row) => {
				// A campaign that did not start has no result, not zero.
				if (row.elapsedDays === 0) {
					return "–";
				}
				const cost = costPerConversion(row.totals);
				return (
					<div className="grid justify-items-end whitespace-nowrap">
						<span>{number.format(row.totals.conversions)}</span>
						<span className="text-muted-foreground text-xs">
							{fillMessage(t("campaigns.resultsLine"), {
								cost: cost === null ? "–" : money.format(cost),
								multiple: formatMultiple(returnOnSpend(row.totals), locale),
							})}
						</span>
					</div>
				);
			},
		},
	];

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("campaigns.title")}
				description={t("campaigns.description")}
			/>
			<Card>
				{/* A phone hides the Flight, Budget, and Results columns, so the table needs no sideways scroll. */}
				<CardContent className="max-md:[&_:is(th,td):nth-child(n+3)]:hidden">
					<DataTable
						rows={rows}
						columns={columns}
						searchText={(row) => `${row.name} ${row.client} ${row.code}`}
						noResults={t("campaigns.noResults")}
						toolbar={
							<>
								<Tabs
									value={activeStatus ?? "all"}
									onValueChange={(value) =>
										navigate({
											search: (previous) => ({
												...previous,
												status: CAMPAIGN_STATUSES.find(
													(option) => option === value,
												),
											}),
											replace: true,
										})
									}
									className="max-w-full overflow-x-auto max-md:-mx-1 max-md:px-1"
								>
									{/* On a phone the tabs stay on one line and scroll sideways. Each tab is 44 px tall. */}
									<TabsList className="max-md:w-max max-md:group-data-[orientation=horizontal]/tabs:h-auto">
										<TabsTrigger value="all" className="max-md:min-h-11">
											{t("campaigns.all")}
											{/* opacity, not a muted color: the count takes the color of the active chip too. */}
											<span className="tabular-nums opacity-70">
												{number.format(inChannel.length)}
											</span>
										</TabsTrigger>
										{tabs.map((tab) => (
											<TabsTrigger
												key={tab.value}
												value={tab.value}
												className="max-md:min-h-11"
											>
												{t(`campaignStatus.${tab.value}`)}
												<span className="tabular-nums opacity-70">
													{number.format(tab.count)}
												</span>
											</TabsTrigger>
										))}
									</TabsList>
								</Tabs>
								<Select
									value={channel ?? ALL_CHANNELS}
									onValueChange={(value) =>
										navigate({
											search: (previous) => ({
												...previous,
												channel: parseChannel(value),
											}),
											replace: true,
										})
									}
								>
									<SelectTrigger
										className="w-full max-md:min-h-11 sm:ms-auto sm:w-48"
										aria-label={t("campaigns.channelFilter")}
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent align="end">
										<SelectItem value={ALL_CHANNELS}>
											{t("campaigns.allChannels")}
										</SelectItem>
										{CHANNELS.map((option) => (
											<SelectItem key={option} value={option}>
												<ChannelMark channel={option} />
												{t(`channels.${option}`)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</>
						}
					/>
				</CardContent>
			</Card>
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8"];

/** Placeholder while the list loader runs. The route sets it as pendingComponent. */
export function CampaignsPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-48" />
				<Skeleton className="h-4 w-72" />
			</div>
			<Card>
				<CardContent className="grid gap-3">
					<div className="flex flex-wrap gap-2">
						<Skeleton className="h-9 w-full sm:max-w-xs" />
						<Skeleton className="h-9 w-80" />
					</div>
					{SKELETON_ROWS.map((key) => (
						<Skeleton key={key} className="h-12 w-full" />
					))}
				</CardContent>
			</Card>
		</div>
	);
}

/** Error state of the campaign pages when a loader fails. Try again runs the loader again. */
export function CampaignsPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("campaigns.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}

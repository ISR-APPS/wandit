// The campaign list behind login: the page header with the CSV export, then a grid of campaign cards.
// The /app/campaigns route renders it after its loader. The route also uses the skeleton and the error below.
// It follows the kit "project list" page: one card per record, four per row on a wide screen.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { PageHeader } from "~/features/app-shell";
import {
	CAMPAIGN_STATUSES,
	downloadCsv,
	fillMessage,
	toCsv,
} from "~/features/marketing";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Skeleton } from "~/shared/ui/skeleton";
import { type Campaign, campaignsQueryOptions } from "../api/campaigns.queries";
import { CampaignTile } from "./campaign-tile";

// One column on a phone, two from 42rem, three from 48rem, four from 64rem: the kit shows four cards per row.
const GRID =
	"grid grid-cols-1 gap-4 @2xl/main:grid-cols-2 @3xl/main:grid-cols-3 @5xl/main:grid-cols-4";

/** The work of today comes first: live, then planned, paused, and ended. The newest flight first in each status. */
export function CampaignsPage() {
	const { t, locale } = useT();
	const { data: campaigns } = useSuspenseQuery(campaignsQueryOptions());
	const number = new Intl.NumberFormat(locale);
	const now = Date.now();
	const sorted = [...campaigns].sort(
		(first, second) =>
			CAMPAIGN_STATUSES.indexOf(first.status) -
				CAMPAIGN_STATUSES.indexOf(second.status) ||
			Date.parse(second.startAt) - Date.parse(first.startAt),
	);

	function exportCampaigns() {
		downloadCsv(
			"campaigns.csv",
			toCsv<Campaign>(sorted, [
				{ header: t("campaigns.code"), value: (row) => row.code },
				{ header: t("campaigns.campaign"), value: (row) => row.name },
				{ header: t("campaigns.client"), value: (row) => row.client },
				{
					header: t("campaigns.status"),
					value: (row) => t(`campaignStatus.${row.status}`),
				},
				{
					header: t("campaigns.start"),
					value: (row) => row.startAt.slice(0, 10),
				},
				{ header: t("campaigns.end"), value: (row) => row.endAt.slice(0, 10) },
				{
					header: t("campaigns.budgetColumn"),
					value: (row) => String(row.budget),
				},
				{
					header: t("metrics.spend"),
					value: (row) => row.totals.spend.toFixed(2),
				},
				{
					header: t("metrics.conversions"),
					value: (row) => String(row.totals.conversions),
				},
			]),
		);
	}

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("campaigns.title")}
				description={fillMessage(t("campaigns.description"), {
					count: number.format(campaigns.length),
				})}
				actions={
					<Button type="button" onClick={exportCampaigns}>
						<DownloadSimpleIcon />
						{t("common.exportCsv")}
					</Button>
				}
			/>
			{sorted.length === 0 ? (
				<p className="text-muted-foreground text-sm">{t("campaigns.empty")}</p>
			) : (
				<div className={GRID}>
					{sorted.map((campaign) => (
						<CampaignTile key={campaign.id} campaign={campaign} now={now} />
					))}
				</div>
			)}
		</div>
	);
}

/** Placeholder while the list loader runs. The route sets it as pendingComponent. */
export function CampaignsPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex items-end justify-between gap-4">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-40" />
					<Skeleton className="h-4 w-64" />
				</div>
				<Skeleton className="h-9 w-32" />
			</div>
			<div className={GRID}>
				{[0, 1, 2, 3, 4, 5, 6, 7].map((slot) => (
					<Skeleton key={slot} className="h-60 rounded-surface" />
				))}
			</div>
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

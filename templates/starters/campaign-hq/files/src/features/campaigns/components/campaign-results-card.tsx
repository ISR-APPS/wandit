// The "Results to date" panel of a campaign: spend, conversions, cost per conversion, and return on ad spend.
// CampaignDetailPage renders it first in its main column. A planned campaign shows its start date instead.
import {
	costPerConversion,
	fillMessage,
	formatMultiple,
	moneyFormat,
	returnOnSpend,
} from "~/features/marketing";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { CampaignDetail } from "../api/campaigns.queries";

type CampaignResultsCardProps = {
	/** The campaign of the page, from campaignQueryOptions. */
	campaign: CampaignDetail;
};

/** Four figures in one strip: 2 columns on a phone, 4 from the medium container width. */
export function CampaignResultsCard({ campaign }: CampaignResultsCardProps) {
	const { t, locale } = useT();
	const date = new Intl.DateTimeFormat(locale, {
		month: "short",
		day: "numeric",
	});
	const totals = campaign.totals;
	const cost = costPerConversion(totals);
	const figures = [
		{
			id: "spend",
			label: t("metrics.spend"),
			value: moneyFormat(locale).format(totals.spend),
		},
		{
			id: "conversions",
			label: t("metrics.conversions"),
			value: new Intl.NumberFormat(locale).format(totals.conversions),
		},
		{
			id: "cpa",
			label: t("metrics.costPerConversion"),
			value: cost === null ? "–" : moneyFormat(locale, "cents").format(cost),
		},
		{
			id: "roas",
			label: t("metrics.returnOnSpend"),
			value: formatMultiple(returnOnSpend(totals), locale),
		},
	];
	const hasStarted = campaign.elapsedDays > 0;

	return (
		<Card className="@container/results">
			<CardHeader>
				<CardTitle>{t("campaigns.results")}</CardTitle>
				<CardDescription>
					{hasStarted
						? fillMessage(t("campaigns.resultsHint"), {
								start: date.format(new Date(campaign.startAt)),
							})
						: fillMessage(t("campaigns.notStarted"), {
								date: date.format(new Date(campaign.startAt)),
							})}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<dl className="grid @lg/results:grid-cols-4 grid-cols-2 gap-x-6 gap-y-5">
					{figures.map((figure) => (
						<div key={figure.id} className="grid gap-1">
							<dt className="label-text text-muted-foreground text-xs">
								{figure.label}
							</dt>
							<dd className="font-numeric text-2xl tabular-nums">
								{hasStarted ? figure.value : "–"}
							</dd>
						</div>
					))}
				</dl>
			</CardContent>
		</Card>
	);
}

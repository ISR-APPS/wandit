// The "Results by channel" panel of a campaign: spend against results for each channel of the plan, and a total row.
// CampaignDetailPage renders it in its main column when the campaign has results.
// In a narrow panel the reach columns hide first, then the conversions. Spend, CPA, and ROAS stay in view.
import {
	addTotals,
	ChannelMark,
	clickRate,
	costPerConversion,
	emptyTotals,
	formatMultiple,
	type MediaTotals,
	moneyFormat,
	returnOnSpend,
} from "~/features/marketing";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableFooter,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";
import type { CampaignDetail } from "../api/campaigns.queries";

type CampaignChannelsCardProps = {
	/** The campaign of the page, from campaignQueryOptions. Its byChannel rows fill the table. */
	campaign: CampaignDetail;
};

// Seven columns need about 42rem of panel. Under it the impressions and the click rate hide.
const REACH_COLUMN = "@max-2xl/channels:hidden";
// Under 28rem, as on a phone, the conversions hide too. The CPA still gives the result per channel.
const CONVERSIONS_COLUMN = "@max-md/channels:hidden";

/** The total row sums the channel rows, so it equals the "Results to date" figures above. */
export function CampaignChannelsCard({ campaign }: CampaignChannelsCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const compact = new Intl.NumberFormat(locale, {
		notation: "compact",
		maximumFractionDigits: 1,
	});
	const money = moneyFormat(locale);
	const cents = moneyFormat(locale, "cents");
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		minimumFractionDigits: 1,
		maximumFractionDigits: 1,
	});
	const total = campaign.byChannel.reduce(
		(sum, row) => addTotals(sum, row.totals),
		emptyTotals(),
	);

	// The same cells for a channel row and the total row.
	function metricCells(totals: MediaTotals) {
		const rate = clickRate(totals);
		const cost = costPerConversion(totals);
		return (
			<>
				<TableCell className="text-end tabular-nums">
					{money.format(totals.spend)}
				</TableCell>
				<TableCell className={cn("text-end tabular-nums", REACH_COLUMN)}>
					{compact.format(totals.impressions)}
				</TableCell>
				<TableCell className={cn("text-end tabular-nums", REACH_COLUMN)}>
					{rate === null ? "–" : percent.format(rate)}
				</TableCell>
				<TableCell className={cn("text-end tabular-nums", CONVERSIONS_COLUMN)}>
					{number.format(totals.conversions)}
				</TableCell>
				<TableCell className="text-end tabular-nums">
					{cost === null ? "–" : cents.format(cost)}
				</TableCell>
				<TableCell className="text-end tabular-nums">
					{formatMultiple(returnOnSpend(totals), locale)}
				</TableCell>
			</>
		);
	}

	return (
		<Card className="@container/channels">
			<CardHeader>
				<CardTitle>{t("campaigns.byChannel")}</CardTitle>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>{t("campaigns.channel")}</TableHead>
							<TableHead className="text-end">{t("metrics.spend")}</TableHead>
							<TableHead className={cn("text-end", REACH_COLUMN)}>
								{t("metrics.impressions")}
							</TableHead>
							<TableHead className={cn("text-end", REACH_COLUMN)}>
								{t("metrics.clickRate")}
							</TableHead>
							<TableHead className={cn("text-end", CONVERSIONS_COLUMN)}>
								{t("metrics.conversions")}
							</TableHead>
							<TableHead className="text-end">
								{t("metrics.costPerConversionShort")}
							</TableHead>
							<TableHead className="text-end">
								{t("metrics.returnOnSpendShort")}
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{campaign.byChannel.map((row) => (
							<TableRow key={row.channel}>
								<TableCell>
									<span className="flex items-center gap-2 whitespace-nowrap">
										<ChannelMark channel={row.channel} />
										{t(`channels.${row.channel}`)}
									</span>
								</TableCell>
								{metricCells(row.totals)}
							</TableRow>
						))}
					</TableBody>
					<TableFooter>
						<TableRow>
							<TableCell className="font-medium">
								{t("campaigns.total")}
							</TableCell>
							{metricCells(total)}
						</TableRow>
					</TableFooter>
				</Table>
			</CardContent>
		</Card>
	);
}

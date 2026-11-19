// The portfolio card of the home: six counts of the work, each as a small badge with its label.
// OverviewPage renders it in the second row. It reads the campaign and the audience lists of their barrels.
// The counts do not depend on the period: they describe the portfolio today.
import { useSuspenseQuery } from "@tanstack/react-query";
import { audiencesQueryOptions } from "~/features/audiences";
import { campaignsQueryOptions } from "~/features/campaigns";
import {
	CAMPAIGN_STATUSES,
	fillMessage,
	moneyFormat,
} from "~/features/marketing";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";

/** A 2 x 3 grid: the four campaign statuses, then the clients and the audiences. */
export function PortfolioCard() {
	const { t, locale } = useT();
	const { data: campaigns } = useSuspenseQuery(campaignsQueryOptions());
	const { data: audiences } = useSuspenseQuery(audiencesQueryOptions());
	const number = new Intl.NumberFormat(locale, { notation: "compact" });
	const money = moneyFormat(locale, "compact");
	const approvedBudget = campaigns
		.filter((campaign) => campaign.status !== "ended")
		.reduce((sum, campaign) => sum + campaign.budget, 0);
	const pairs = [
		...CAMPAIGN_STATUSES.map((status) => ({
			key: status,
			value: campaigns.filter((campaign) => campaign.status === status).length,
			label: t(`campaignStatus.${status}`),
		})),
		{
			key: "clients",
			value: new Set(campaigns.map((campaign) => campaign.client)).size,
			label: t("overview.clients"),
		},
		{
			key: "audiences",
			value: audiences.length,
			label: t("audiences.title"),
		},
	];

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("overview.portfolioTitle")}</CardTitle>
				<CardDescription>
					{fillMessage(t("overview.portfolioHint"), {
						budget: money.format(approvedBudget),
					})}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<dl className="grid grid-cols-2 gap-4">
					{pairs.map((pair) => (
						<div key={pair.key} className="flex items-center gap-3">
							<dt className="truncate">{pair.label}</dt>
							{/* The badge shows first, as in the kit. A screen reader still reads the label first. */}
							<dd className="order-first">
								<Badge
									variant="secondary"
									className="w-12 border-border tabular-nums"
								>
									{number.format(pair.value)}
								</Badge>
							</dd>
						</div>
					))}
				</dl>
			</CardContent>
		</Card>
	);
}

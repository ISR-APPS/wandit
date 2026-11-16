// The "Biggest live campaigns" tile of the home: the 5 live campaigns with the most spend so far.
// OverviewPage renders it under the two small figures. Each row opens the campaign page.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { campaignsQueryOptions } from "~/features/campaigns";
import { moneyFormat } from "~/features/marketing";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";

// The tile ranks the 5 largest rows, as the bento home asks.
const RANKED_COUNT = 5;

type TopCampaignsCardProps = {
	/** The span classes of the bento slot. */
	className?: string;
};

/** Each share bar compares a campaign with the largest one of the list. */
export function TopCampaignsCard({ className }: TopCampaignsCardProps) {
	const { t, locale } = useT();
	const { data: campaigns } = useSuspenseQuery(campaignsQueryOptions());
	const money = moneyFormat(locale, "compact");
	const number = new Intl.NumberFormat(locale);
	// LIMIT: ranks the rows of the list query in the browser, at most 1,000 campaigns. Upgrade: a SQL order and limit.
	const ranked = campaigns
		.filter((campaign) => campaign.status === "live")
		.sort((first, second) => second.totals.spend - first.totals.spend)
		.slice(0, RANKED_COUNT);
	const largest = ranked[0]?.totals.spend ?? 0;

	return (
		<Card className={cn("gap-4", className)}>
			<CardHeader>
				<CardTitle>{t("overview.rankedTitle")}</CardTitle>
				<CardDescription>{t("overview.rankedHint")}</CardDescription>
			</CardHeader>
			<CardContent>
				{ranked.length === 0 ? (
					<p className="py-6 text-center text-muted-foreground text-sm">
						{t("overview.rankedEmpty")}
					</p>
				) : (
					<ol className="grid gap-1">
						{ranked.map((campaign, index) => (
							<li key={campaign.id}>
								<Link
									to="/app/campaigns/$campaignId"
									params={{ campaignId: campaign.id }}
									className="-mx-2 grid min-h-11 grid-cols-[1.25rem_1fr_auto] items-center gap-x-2 gap-y-1 rounded-control px-2 py-1.5 hover:bg-accent"
								>
									<span className="font-numeric text-muted-foreground text-sm tabular-nums">
										{number.format(index + 1)}
									</span>
									<span className="truncate font-medium text-sm" dir="auto">
										{campaign.name}
									</span>
									<span className="text-sm tabular-nums">
										{money.format(campaign.totals.spend)}
									</span>
									<Progress
										value={campaign.totals.spend}
										max={largest}
										aria-label={campaign.name}
										className="col-start-2 col-end-4 h-1.5"
									/>
								</Link>
							</li>
						))}
					</ol>
				)}
			</CardContent>
		</Card>
	);
}

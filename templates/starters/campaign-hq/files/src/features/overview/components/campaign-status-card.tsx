// The "Campaigns" tile of the home: the count of campaigns per status, each with a share bar.
// OverviewPage renders it in the first bento row. Each line opens the campaign list on the tab of its status.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { campaignsQueryOptions } from "~/features/campaigns";
import { CAMPAIGN_STATUSES, CampaignStatusBadge } from "~/features/marketing";
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

type CampaignStatusCardProps = {
	/** The span classes of the bento slot. */
	className?: string;
};

/** The counts come from the campaign list, so they equal the tab counts of the list page. */
export function CampaignStatusCard({ className }: CampaignStatusCardProps) {
	const { t, locale } = useT();
	const { data: campaigns } = useSuspenseQuery(campaignsQueryOptions());
	const number = new Intl.NumberFormat(locale);
	// LIMIT: counts the rows of the list query in the browser, at most 1,000 campaigns. Upgrade: a SQL count per status.
	const lines = CAMPAIGN_STATUSES.map((status) => ({
		status,
		count: campaigns.filter((campaign) => campaign.status === status).length,
	}));

	return (
		<Card className={cn("gap-4", className)}>
			<CardHeader>
				<CardTitle>{t("overview.statusTitle")}</CardTitle>
				<CardDescription>{t("overview.statusHint")}</CardDescription>
			</CardHeader>
			<CardContent>
				<ul className="grid gap-1">
					{lines.map((line) => (
						<li key={line.status}>
							<Link
								to="/app/campaigns"
								search={{ status: line.status }}
								className="-mx-2 grid min-h-11 content-center gap-1.5 rounded-control px-2 py-1.5 hover:bg-accent"
							>
								<span className="flex items-center justify-between gap-2">
									<CampaignStatusBadge status={line.status} />
									<span className="font-numeric text-lg tabular-nums">
										{number.format(line.count)}
									</span>
								</span>
								<Progress
									value={line.count}
									max={campaigns.length}
									aria-label={t(`campaignStatus.${line.status}`)}
									className="h-1.5"
								/>
							</Link>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}

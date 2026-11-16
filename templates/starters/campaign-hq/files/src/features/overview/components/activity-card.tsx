// The "Latest activity" tile of the home: the newest events of every campaign, with their time.
// OverviewPage renders it as the full-width last row of the bento. Each campaign name opens its page.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	CampaignEventItem,
	recentCampaignEventsQueryOptions,
} from "~/features/campaigns";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";

type ActivityCardProps = {
	/** The span classes of the bento slot. */
	className?: string;
};

/** Two columns from a medium page and three from a wide page, so the full-width tile stays short. */
export function ActivityCard({ className }: ActivityCardProps) {
	const { t } = useT();
	const { data: events } = useSuspenseQuery(recentCampaignEventsQueryOptions());
	const now = Date.now();
	return (
		<Card className={cn("gap-4", className)}>
			<CardHeader>
				<CardTitle>{t("overview.activityTitle")}</CardTitle>
				<CardAction>
					<Button asChild variant="outline" size="sm">
						<Link to="/app/campaigns">{t("overview.allCampaigns")}</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				{events.length === 0 ? (
					<p className="py-6 text-center text-muted-foreground text-sm">
						{t("overview.activityEmpty")}
					</p>
				) : (
					<ol className="grid @3xl/main:grid-cols-3 @xl/main:grid-cols-2 gap-x-8 gap-y-4">
						{events.map((event) => (
							<CampaignEventItem
								key={event.id}
								event={event}
								now={now}
								linkCampaign
							/>
						))}
					</ol>
				)}
			</CardContent>
		</Card>
	);
}

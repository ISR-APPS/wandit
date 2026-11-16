// The "Content" panel of a campaign: the next items of its calendar, then the items that went out last.
// CampaignDetailPage renders it in its main column. The header links to the calendar, filtered to this campaign.
import { Link } from "@tanstack/react-router";
import { fillMessage } from "~/features/marketing";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { CampaignDetail } from "../api/campaigns.queries";
import { CampaignContentRow } from "./campaign-content-row";

// The panel lists the next 4 items and the last 3 that went out. The calendar shows the rest.
const NEXT_COUNT = 4;
const PAST_COUNT = 3;

type CampaignContentCardProps = {
	/** The campaign of the page, from campaignQueryOptions. */
	campaign: CampaignDetail;
};

/** Two short lists. A campaign with no item shows one sentence. */
export function CampaignContentCard({ campaign }: CampaignContentCardProps) {
	const { t, locale } = useT();
	const upcoming = campaign.content
		.filter((item) => item.status !== "published")
		.slice(0, NEXT_COUNT);
	const published = campaign.content
		.filter((item) => item.status === "published")
		.slice(-PAST_COUNT)
		.reverse();
	const groups = [
		{ id: "next", title: t("campaigns.nextContent"), items: upcoming },
		{ id: "past", title: t("campaigns.pastContent"), items: published },
	].filter((group) => group.items.length > 0);
	// The hint counts the rows of the panel, so its number matches what the user sees.
	const shownCount = upcoming.length + published.length;
	const number = new Intl.NumberFormat(locale);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("campaigns.content")}</CardTitle>
				<CardDescription>
					{fillMessage(
						t(
							shownCount < campaign.content.length
								? "campaigns.contentHintPart"
								: campaign.content.length === 1
									? "campaigns.contentHintOne"
									: "campaigns.contentHint",
						),
						{
							shown: number.format(shownCount),
							count: number.format(campaign.content.length),
						},
					)}
				</CardDescription>
				<CardAction>
					<Button asChild variant="outline" size="sm">
						<Link to="/app/calendar" search={{ campaign: campaign.id }}>
							{t("campaigns.openCalendar")}
						</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent className="grid gap-5">
				{groups.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("campaigns.noContent")}
					</p>
				) : (
					groups.map((group) => (
						<section key={group.id} className="grid gap-2">
							<h2 className="label-text font-sans text-muted-foreground text-xs">
								{group.title}
							</h2>
							<ul className="grid gap-2">
								{group.items.map((item) => (
									<CampaignContentRow key={item.id} item={item} />
								))}
							</ul>
						</section>
					))
				)}
			</CardContent>
		</Card>
	);
}

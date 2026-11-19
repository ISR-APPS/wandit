// The audiences card of a campaign page: each segment it targets, with its size and a link to its panel.
// CampaignDetailPage renders it beside the content card. It follows the kit "connections" card.
// "Open" goes to /app/audiences?audience=<id>, where the side panel of the segment opens.
import { Link } from "@tanstack/react-router";
import { fillMessage, initialsOf } from "~/features/marketing";
import { useT } from "~/shared/i18n";
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { CaretRightIcon } from "~/shared/ui/icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/shared/ui/tooltip";
import type { CampaignDetail } from "../api/campaigns.queries";

type CampaignAudiencesCardProps = {
	/** The campaign of the page, from campaignQueryOptions. */
	campaign: CampaignDetail;
};

/** A campaign with no segment shows one sentence. */
export function CampaignAudiencesCard({
	campaign,
}: CampaignAudiencesCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale, { notation: "compact" });
	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("campaigns.audiences")}</CardTitle>
				<CardAction>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button variant="outline" size="icon" asChild>
								<Link
									to="/app/audiences"
									aria-label={t("campaigns.allAudiences")}
								>
									<CaretRightIcon className="rtl:rotate-180" />
								</Link>
							</Button>
						</TooltipTrigger>
						<TooltipContent>{t("campaigns.allAudiences")}</TooltipContent>
					</Tooltip>
				</CardAction>
			</CardHeader>
			<CardContent>
				{campaign.audiences.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("campaigns.noAudience")}
					</p>
				) : (
					<ul className="grid gap-4">
						{campaign.audiences.map((audience) => (
							<li
								key={audience.id}
								className="flex items-center justify-between gap-4"
							>
								<div className="flex min-w-0 items-center gap-4">
									<Avatar>
										<AvatarFallback className="text-xs">
											{initialsOf(audience.name)}
										</AvatarFallback>
									</Avatar>
									<div className="grid min-w-0">
										<span className="font-medium leading-tight" dir="auto">
											{audience.name}
										</span>
										<span className="text-muted-foreground text-xs">
											{`${fillMessage(t("campaigns.people"), {
												count: number.format(audience.size),
											})} · ${t(`audienceTypes.${audience.type}`)}`}
										</span>
									</div>
								</div>
								<Button variant="outline" size="sm" asChild>
									<Link to="/app/audiences" search={{ audience: audience.id }}>
										{t("campaigns.openAudience")}
									</Link>
								</Button>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}

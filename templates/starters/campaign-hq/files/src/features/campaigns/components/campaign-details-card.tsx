// The "Details" panel of a campaign: the brief, the client, the objective, the owner, the flight, and the audiences.
// CampaignDetailPage renders it in its rail. Each audience links to its panel on the audiences page.
import { Link } from "@tanstack/react-router";
import {
	dayCountFormat,
	fillMessage,
	formatFlight,
} from "~/features/marketing";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import type { CampaignDetail } from "../api/campaigns.queries";

type CampaignDetailsCardProps = {
	/** The campaign of the page, from campaignQueryOptions. */
	campaign: CampaignDetail;
};

/** One `dl` of facts. The audience sizes are compact, for example "1.8M people". */
export function CampaignDetailsCard({ campaign }: CampaignDetailsCardProps) {
	const { t, locale } = useT();
	const compact = new Intl.NumberFormat(locale, {
		notation: "compact",
		maximumFractionDigits: 1,
	});
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("campaigns.details")}</CardTitle>
			</CardHeader>
			<CardContent>
				<dl className="grid gap-4 text-sm">
					<div className="grid gap-1">
						<dt className="text-muted-foreground">{t("campaigns.brief")}</dt>
						<dd dir="auto">{campaign.brief}</dd>
					</div>
					<div className="grid grid-cols-2 gap-4">
						<div className="grid gap-1">
							<dt className="text-muted-foreground">{t("campaigns.client")}</dt>
							<dd dir="auto">{campaign.client}</dd>
						</div>
						<div className="grid gap-1">
							<dt className="text-muted-foreground">
								{t("campaigns.objective")}
							</dt>
							<dd>{t(`objectives.${campaign.objective}`)}</dd>
						</div>
						<div className="grid gap-1">
							<dt className="text-muted-foreground">{t("campaigns.owner")}</dt>
							<dd className="grid">
								<span>{campaign.ownerName}</span>
								<span className="text-muted-foreground text-xs">
									{campaign.ownerRole}
								</span>
							</dd>
						</div>
						<div className="grid gap-1">
							<dt className="text-muted-foreground">{t("campaigns.flight")}</dt>
							<dd className="grid">
								<span>
									{formatFlight(campaign.startAt, campaign.endAt, locale)}
								</span>
								<span className="text-muted-foreground text-xs">
									{dayCountFormat(locale).format(campaign.flightDays)}
								</span>
							</dd>
						</div>
					</div>
					<div className="grid gap-2">
						<dt className="text-muted-foreground">
							{t("campaigns.audiences")}
						</dt>
						<dd>
							<ul className="grid gap-2">
								{campaign.audiences.map((audience) => (
									<li key={audience.id}>
										<Link
											to="/app/audiences"
											search={{ audience: audience.id }}
											className="flex min-h-11 items-center justify-between gap-3 rounded-control border px-3 py-2 hover:bg-accent"
										>
											<span className="grid">
												<span className="font-medium" dir="auto">
													{audience.name}
												</span>
												<span className="text-muted-foreground text-xs">
													{t(`audienceTypes.${audience.type}`)}
												</span>
											</span>
											<span className="shrink-0 text-muted-foreground text-xs tabular-nums">
												{fillMessage(t("campaigns.people"), {
													count: compact.format(audience.size),
												})}
											</span>
										</Link>
									</li>
								))}
							</ul>
						</dd>
					</div>
				</dl>
			</CardContent>
		</Card>
	);
}

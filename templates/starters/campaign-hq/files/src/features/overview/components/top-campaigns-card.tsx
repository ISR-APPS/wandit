// The "Top campaigns" card of the home: the 6 campaigns with the most conversions in the period.
// OverviewPage renders it in the third row and passes the period data. Each name opens the campaign page.
// Each row shows the client initials, the name, the change against the period before, and the conversions.
import { Link } from "@tanstack/react-router";
import { fillMessage, initialsOf } from "~/features/marketing";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { CaretRightIcon } from "~/shared/ui/icons";
import type { Overview } from "../api/overview.queries";

type TopCampaignsCardProps = {
	/** The data of the chosen period. */
	overview: Overview;
	/** The period in words, for example "Last 30 days". */
	periodLabel: string;
};

/** A period with no conversion shows one sentence and the link to every campaign. */
export function TopCampaignsCard({
	overview,
	periodLabel,
}: TopCampaignsCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		signDisplay: "exceptZero",
		maximumFractionDigits: 1,
	});

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("overview.topTitle")}</CardTitle>
				<CardDescription>{periodLabel}</CardDescription>
				<CardAction>
					<Button variant="outline" size="sm" asChild>
						<Link to="/app/campaigns">
							{t("common.viewAll")}
							<CaretRightIcon className="size-4 rtl:rotate-180" />
						</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				{overview.topCampaigns.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("overview.topEmpty")}
					</p>
				) : (
					<ul className="grid gap-5">
						{overview.topCampaigns.map((campaign) => (
							<li key={campaign.id} className="flex items-center gap-4">
								<Avatar className="size-10">
									<AvatarFallback className="bg-muted text-sm">
										{initialsOf(campaign.client)}
									</AvatarFallback>
								</Avatar>
								<div className="grid min-w-0 gap-1">
									<Link
										to="/app/campaigns/$campaignId"
										params={{ campaignId: campaign.id }}
										className="font-medium text-sm leading-tight hover:underline"
									>
										{campaign.name}
									</Link>
									<p className="text-muted-foreground text-sm">
										{campaign.change === null ? (
											campaign.client
										) : (
											<>
												<bdi
													dir="ltr"
													className={cn(
														"tabular-nums",
														campaign.change < 0
															? "text-destructive"
															: "text-success",
													)}
												>
													{percent.format(campaign.change)}
												</bdi>{" "}
												{t("overview.fromPrevious")}
											</>
										)}
									</p>
								</div>
								<p className="ms-auto shrink-0 font-medium tabular-nums">
									{fillMessage(t("overview.conversionsShort"), {
										count: number.format(campaign.conversions),
									})}
								</p>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}

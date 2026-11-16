// The panel of one audience inside the side sheet: its size and growth, its 90-day curve, how it is built,
// its engagement, and the campaigns that target it. AudienceSheet renders it.
import { Link } from "@tanstack/react-router";
import { CampaignStatusBadge, ChangeLine } from "~/features/marketing";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Separator } from "~/shared/ui/separator";
import { SheetDescription, SheetHeader, SheetTitle } from "~/shared/ui/sheet";
import type { Audience } from "../api/audiences.queries";
import { AudienceSizeChart } from "./audience-size-chart";

type AudiencePanelProps = {
	audience: Audience;
};

/** The sheet title is the audience name, so the sheet has an accessible name. */
export function AudiencePanel({ audience }: AudiencePanelProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		minimumFractionDigits: 1,
		maximumFractionDigits: 1,
	});
	return (
		<>
			<SheetHeader className="gap-2 border-b pe-12">
				<Badge variant="outline">{t(`audienceTypes.${audience.type}`)}</Badge>
				<SheetTitle className="font-display text-xl" dir="auto">
					{audience.name}
				</SheetTitle>
				<SheetDescription dir="auto">{audience.client}</SheetDescription>
			</SheetHeader>
			<div className="grid gap-6 p-4">
				<section className="grid gap-3">
					<div className="flex flex-wrap items-end justify-between gap-3">
						<div className="grid gap-1">
							<p className="label-text text-muted-foreground text-sm">
								{t("audiences.size")}
							</p>
							<p className="font-numeric text-3xl tabular-nums">
								{number.format(audience.size)}
							</p>
						</div>
						<ChangeLine
							change={audience.growth}
							goodWhen="up"
							srLabel={t("audiences.growthLabel")}
						/>
					</div>
					<p className="text-muted-foreground text-xs">
						{t("audiences.sizeTrend")}
					</p>
					<AudienceSizeChart sizeByDay={audience.sizeByDay} />
				</section>
				<Separator />
				<section className="grid gap-1.5 text-sm">
					<h3 className="font-medium font-sans">{t("audiences.definition")}</h3>
					<p className="text-muted-foreground" dir="auto">
						{audience.definition}
					</p>
				</section>
				<section className="grid gap-1.5 text-sm">
					<h3 className="font-medium font-sans">{t("audiences.engagement")}</h3>
					<p className="font-numeric text-2xl tabular-nums">
						{percent.format(audience.engagementRate)}
					</p>
					<p className="text-muted-foreground text-xs">
						{t("audiences.engagementHint")}
					</p>
				</section>
				<Separator />
				<section className="grid gap-2 text-sm">
					<h3 className="font-medium font-sans">{t("audiences.usedBy")}</h3>
					{audience.campaigns.length === 0 ? (
						<p className="text-muted-foreground">{t("audiences.notUsed")}</p>
					) : (
						<ul className="grid gap-2">
							{audience.campaigns.map((campaign) => (
								<li key={campaign.id}>
									<Link
										to="/app/campaigns/$campaignId"
										params={{ campaignId: campaign.id }}
										className="flex min-h-11 items-center justify-between gap-3 rounded-control border px-3 py-2 hover:bg-accent"
									>
										<span className="truncate font-medium" dir="auto">
											{campaign.name}
										</span>
										<CampaignStatusBadge status={campaign.status} />
									</Link>
								</li>
							))}
						</ul>
					)}
				</section>
			</div>
		</>
	);
}

// The profile card of a campaign page: the client initials, the name and status, three result figures, and facts.
// CampaignDetailPage renders it first in its 1/3 column. It follows the kit profile card.
// The figures cover the flight from its start to yesterday.
import {
	BuildingsIcon,
	CalendarBlankIcon,
	HashIcon,
	UserCircleIcon,
	WalletIcon,
} from "@phosphor-icons/react";
import {
	CampaignStatusBadge,
	fillMessage,
	formatFlight,
	formatMultiple,
	initialsOf,
	moneyFormat,
	returnOnSpend,
} from "~/features/marketing";
import { useT } from "~/shared/i18n";
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";
import { Card, CardContent } from "~/shared/ui/card";
import type { CampaignDetail } from "../api/campaigns.queries";

type CampaignProfileCardProps = {
	/** The campaign of the page, from campaignQueryOptions. */
	campaign: CampaignDetail;
};

/** The facts list is a dl: each icon stands for the term, and a screen reader reads the term text. */
export function CampaignProfileCard({ campaign }: CampaignProfileCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale, "compact");
	const number = new Intl.NumberFormat(locale, { notation: "compact" });
	const figures = [
		{
			key: "spend",
			value: money.format(campaign.totals.spend),
			label: t("metrics.spend"),
		},
		{
			key: "conversions",
			value: number.format(campaign.totals.conversions),
			label: t("metrics.conversions"),
		},
		{
			key: "roas",
			value: formatMultiple(returnOnSpend(campaign.totals), locale),
			label: t("metrics.returnOnSpendShort"),
		},
	];
	const facts = [
		{
			key: "client",
			icon: BuildingsIcon,
			term: t("campaigns.client"),
			text: campaign.client,
		},
		{
			key: "owner",
			icon: UserCircleIcon,
			term: t("campaigns.owner"),
			text: `${campaign.ownerName}, ${campaign.ownerRole}`,
		},
		{
			key: "flight",
			icon: CalendarBlankIcon,
			term: t("campaigns.flight"),
			text: formatFlight(campaign.startAt, campaign.endAt, locale),
		},
		{
			key: "budget",
			icon: WalletIcon,
			term: t("campaigns.budgetColumn"),
			text: fillMessage(t("campaigns.budgetApproved"), {
				budget: moneyFormat(locale).format(campaign.budget),
			}),
		},
		{
			key: "code",
			icon: HashIcon,
			term: t("campaigns.code"),
			text: campaign.code,
		},
	];

	return (
		<Card>
			<CardContent className="grid gap-12">
				<div className="grid justify-items-center gap-4">
					<Avatar className="size-20">
						<AvatarFallback className="bg-muted font-display font-semibold text-2xl">
							{initialsOf(campaign.client)}
						</AvatarFallback>
					</Avatar>
					<div className="grid justify-items-center gap-1 text-center">
						<div className="flex flex-wrap items-center justify-center gap-2">
							<p className="font-semibold text-xl" dir="auto">
								{campaign.name}
							</p>
							<CampaignStatusBadge status={campaign.status} />
						</div>
						<p className="text-muted-foreground text-sm">
							{t(`objectives.${campaign.objective}`)}
						</p>
					</div>
				</div>
				<dl className="grid grid-cols-3 divide-x rounded-md border bg-muted text-center rtl:divide-x-reverse">
					{figures.map((figure) => (
						<div key={figure.key} className="grid gap-0.5 py-3">
							<dt className="order-last text-muted-foreground text-sm">
								{figure.label}
							</dt>
							<dd className="font-numeric font-semibold text-lg tabular-nums">
								{figure.value}
							</dd>
						</div>
					))}
				</dl>
				<dl className="grid gap-4">
					{facts.map((fact) => {
						const Icon = fact.icon;
						return (
							<div key={fact.key} className="flex items-center gap-3 text-sm">
								<dt>
									<Icon
										className="size-4 text-muted-foreground"
										aria-hidden="true"
									/>
									<span className="sr-only">{fact.term}</span>
								</dt>
								<dd className="min-w-0 truncate" dir="auto">
									{fact.text}
								</dd>
							</div>
						);
					})}
				</dl>
			</CardContent>
		</Card>
	);
}

// One card of the deal board: the deal, its company and contact, the people, the chance to win,
// the amount, and the counts of its activities and open tasks. The whole card links to the deal page.
// BoardColumn renders one card per deal. It follows the kanban card of the kit page anatomy.
import {
	ChatCircleIcon,
	CheckSquareIcon,
	FlagPennantIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import {
	fillMessage,
	formatAge,
	isStalledDeal,
	moneyFormat,
	PersonAvatar,
	STAGE_PROBABILITY,
} from "~/features/crm";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Card, CardContent } from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import { Separator } from "~/shared/ui/separator";
import type { Deal } from "../api/deals.queries";

type DealCardProps = {
	deal: Deal;
	/** The current time in milliseconds since 1970. The age in the stage counts from it. */
	now: number;
};

/** A stalled deal shows a flag badge with its age in the stage. The bar is the chance to win of the stage. */
export function DealCard({ deal, now }: DealCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, { style: "percent" });
	const probability = STAGE_PROBABILITY[deal.stage];
	const age = formatAge(deal.stageChangedAt, now, locale);
	return (
		<Link
			to="/app/deals/$dealId"
			params={{ dealId: deal.id }}
			className="group/card rounded-surface outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
		>
			<Card className="gap-3 py-4 transition-colors group-hover/card:border-ring">
				<CardContent className="grid gap-3 px-4">
					<div className="flex items-start justify-between gap-2">
						<p
							className="line-clamp-2 font-display font-semibold leading-snug"
							dir="auto"
						>
							{deal.name}
						</p>
						{isStalledDeal(deal, now) ? (
							<Badge variant="warning" className="shrink-0 tabular-nums">
								<FlagPennantIcon />
								<span className="sr-only">{t("deals.stalled")}</span>
								{age}
							</Badge>
						) : null}
					</div>
					<p className="line-clamp-2 text-muted-foreground text-sm" dir="auto">
						{`${deal.companyName} · ${deal.contactName}`}
					</p>
					<div className="flex items-center justify-between gap-2">
						{/* The names are in the text above and in the sr-only line, so the avatars stay decorative. */}
						{/* A small overlap: a larger one hides the second letter of the initials under it. */}
						<div className="flex -space-x-1">
							<PersonAvatar
								name={deal.ownerName}
								className="size-7 text-xs ring-2 ring-card"
							/>
							<PersonAvatar
								name={deal.contactName}
								className="size-7 text-xs ring-2 ring-card"
							/>
						</div>
						<span className="sr-only">
							{fillMessage(t("deals.ownedBy"), { owner: deal.ownerName })}
						</span>
						<div className="flex items-center gap-2">
							<Progress
								value={probability * 100}
								className="h-1.5 w-16"
								aria-label={t("deals.probability")}
							/>
							<span className="text-muted-foreground text-xs tabular-nums">
								{percent.format(probability)}
							</span>
						</div>
					</div>
					<Separator />
					<div className="flex items-center justify-between gap-2">
						<span className="font-numeric font-semibold text-sm tabular-nums">
							{money.format(deal.amount)}
						</span>
						<span className="flex items-center gap-3 text-muted-foreground text-xs tabular-nums">
							<span className="inline-flex items-center gap-1">
								<ChatCircleIcon className="size-3.5" />
								{number.format(deal.activityCount)}
								<span className="sr-only">{t("deals.activitiesCount")}</span>
							</span>
							<span className="inline-flex items-center gap-1">
								<CheckSquareIcon className="size-3.5" />
								{number.format(deal.openTaskCount)}
								<span className="sr-only">{t("deals.tasksCount")}</span>
							</span>
						</span>
					</div>
				</CardContent>
			</Card>
		</Link>
	);
}

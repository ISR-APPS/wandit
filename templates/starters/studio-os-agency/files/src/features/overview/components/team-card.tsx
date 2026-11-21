// The side card of the home: the headcount, the people with the most billable hours, and three highlights.
// OverviewPage renders it at 1/3 of the second band, next to the hours chart.
// Each highlight row shows an arrow for the direction and a color for good or bad news.
import { ArrowDownLeftIcon, ArrowUpRightIcon } from "@phosphor-icons/react";
import { PersonAvatar, useFormatters } from "~/features/studio";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/shared/ui/tooltip";
import type { BusyMember, Highlight } from "../lib/overview-data";

type TeamCardProps = {
	/** People of the studio. */
	headcount: number;
	/** The people with the most billable hours in the period, the most first. */
	busiest: BusyMember[];
	highlights: Highlight[];
};

/** The avatars overlap as in the kit. A tooltip and the accessible name give the name and the hours. */
export function TeamCard({ headcount, busiest, highlights }: TeamCardProps) {
	const { t, locale } = useT();
	const { hours } = useFormatters();

	return (
		<Card className="h-full">
			<CardHeader>
				<CardDescription>{t("overview.team.headcount")}</CardDescription>
				<CardTitle className="font-numeric @4xl/main:text-3xl text-2xl tabular-nums">
					{new Intl.NumberFormat(locale).format(headcount)}
				</CardTitle>
			</CardHeader>
			<CardContent>
				<p className="mb-2 font-semibold text-sm">
					{t("overview.team.busiest")}
				</p>
				<ul className="flex -space-x-2">
					{busiest.map((member) => (
						<li key={member.id}>
							<Tooltip>
								<TooltipTrigger
									className="rounded-full"
									aria-label={`${member.name}, ${hours(member.billable)}`}
								>
									<PersonAvatar
										name={member.name}
										className="size-11 ring-4 ring-card"
									/>
								</TooltipTrigger>
								<TooltipContent>{`${member.name} · ${hours(member.billable)}`}</TooltipContent>
							</Tooltip>
						</li>
					))}
				</ul>
				<p className="mt-8 mb-2 font-semibold text-sm">
					{t("overview.team.highlights")}
				</p>
				<dl className="divide-y *:py-3">
					{highlights.map((highlight) => (
						<HighlightRow key={highlight.id} highlight={highlight} />
					))}
				</dl>
			</CardContent>
		</Card>
	);
}

/** One row: the label, then the arrow and the value. No earlier data shows the value with no arrow. */
function HighlightRow({ highlight }: { highlight: Highlight }) {
	const { t, locale } = useT();
	const { change } = highlight;
	const isUp = change !== null && change > 0;
	const isGood = change !== null && isUp === (highlight.goodWhen === "up");
	const ArrowIcon = isUp ? ArrowUpRightIcon : ArrowDownLeftIcon;
	return (
		<div className="flex items-center justify-between gap-4 text-sm">
			<dt>{t(`overview.team.rows.${highlight.id}`)}</dt>
			<dd className="flex items-center gap-1 tabular-nums">
				{change === null || change === 0 ? null : (
					<ArrowIcon
						className={cn(
							"size-4 rtl:-scale-x-100",
							isGood ? "text-success" : "text-destructive",
						)}
						aria-label={t(isUp ? "overview.team.up" : "overview.team.down")}
					/>
				)}
				{new Intl.NumberFormat(locale, highlight.format).format(
					highlight.value,
				)}
			</dd>
		</div>
	);
}
